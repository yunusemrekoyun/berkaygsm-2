import Order from "../../src/server/models/Order.js";
import { localProvider } from "../../src/server/media/providers/localProvider.js";
import {
  bootstrapRuntime,
  downloadAsset,
  getManifestItem,
  isManagedMediaUrl,
  loadManifest,
  parseBooleanArg,
  parseCliArgs,
  parsePositiveInt,
  printScriptHeader,
  resolveManifestPath,
  saveManifest,
  setManifestItem,
} from "./shared.mjs";

function resolveId(doc) {
  return doc?._id?.toString?.() || String(doc?._id || "");
}

function printHelp() {
  console.log(`Usage: node ops/media/backfill-order-images.mjs [options]

Options:
  --env <path>         Env file path
  --manifest <path>    Manifest JSON path
  --limit <n>          Max migrated image count
  --dry-run            Print plan without mutating DB
  --help               Show this help
`);
}

function buildTasks(order) {
  const orderId = resolveId(order);
  const tasks = [];

  (order.items || []).forEach((item, index) => {
    if (!item?.image) return;
    tasks.push({
      manifestKey: `orders:${orderId}:items.${index}.image`,
      fieldPath: `items.${index}.image`,
      sourceUrl: item.image,
      targetPublicId: `orders/${orderId}/item-${index + 1}`,
      apply(asset) {
        order.items[index].image = asset.url;
      },
    });
  });

  (order.accounting?.stockUsage || []).forEach((usage, index) => {
    if (!usage?.image) return;
    tasks.push({
      manifestKey: `orders:${orderId}:accounting.stockUsage.${index}.image`,
      fieldPath: `accounting.stockUsage.${index}.image`,
      sourceUrl: usage.image,
      targetPublicId: `orders/${orderId}/stock-usage-${index + 1}`,
      apply(asset) {
        order.accounting.stockUsage[index].image = asset.url;
      },
    });
  });

  return tasks;
}

function shouldSkip(task, manifest) {
  if (!task.sourceUrl) return { skip: true, reason: "missing_url" };
  if (isManagedMediaUrl(task.sourceUrl)) {
    return { skip: true, reason: "already_managed" };
  }
  const manifestItem = getManifestItem(manifest, task.manifestKey);
  if (manifestItem?.status === "done") {
    return { skip: true, reason: "manifest_done" };
  }
  return { skip: false };
}

async function main() {
  const args = parseCliArgs();
  if (args.help) {
    printHelp();
    return;
  }

  const envFile = args.env;
  const manifestPath = resolveManifestPath(
    args.manifest,
    "order-image-backfill-manifest.json"
  );
  const dryRun = parseBooleanArg(args["dry-run"], false);
  const limit = parsePositiveInt(args.limit, null);

  const { envFile: loadedEnvFile } = await bootstrapRuntime({ envFile });
  const manifest = await loadManifest(manifestPath);

  printScriptHeader("Order Image Backfill", {
    envFile: loadedEnvFile || "not-found",
    manifestPath,
    dryRun,
    limit: limit ?? "none",
  });

  const summary = {
    migrated: 0,
    skipped: 0,
    errors: 0,
  };

  outer: for await (const order of Order.find({}, "_id items accounting").cursor()) {
    const tasks = buildTasks(order);
    const completedForOrder = [];
    let mutated = false;

    for (const task of tasks) {
      if (limit != null && summary.migrated >= limit) {
        break outer;
      }

      const skip = shouldSkip(task, manifest);
      if (skip.skip) {
        summary.skipped += 1;
        continue;
      }

      try {
        if (dryRun) {
          summary.migrated += 1;
          console.log(
            `[orders] ${task.fieldPath} -> ${task.targetPublicId} (dry-run)`
          );
          continue;
        }

        const download = await downloadAsset(task.sourceUrl);
        const asset = await localProvider.uploadBuffer(download.buffer, {
          folder: "orders",
          publicId: task.targetPublicId,
          resourceType: "image",
          mimeType: download.mimeType,
          originalName: download.originalName,
        });

        task.apply(asset);
        completedForOrder.push({ task, asset });
        mutated = true;
        summary.migrated += 1;

        console.log(`[orders] ${task.fieldPath} -> ${task.targetPublicId}`);
      } catch (error) {
        summary.errors += 1;
        setManifestItem(manifest, task.manifestKey, {
          status: "error",
          orderId: resolveId(order),
          fieldPath: task.fieldPath,
          oldUrl: task.sourceUrl,
          error: error.message,
        });
        console.error(`[orders] ${task.fieldPath} failed: ${error.message}`);
        await saveManifest(manifestPath, manifest);
      }
    }

    if (!dryRun && mutated) {
      try {
        await order.save();
        completedForOrder.forEach(({ task, asset }) => {
          setManifestItem(manifest, task.manifestKey, {
            status: "done",
            orderId: resolveId(order),
            fieldPath: task.fieldPath,
            oldUrl: task.sourceUrl,
            newUrl: asset.url,
            publicId: asset.publicId,
          });
        });
      } catch (error) {
        summary.errors += completedForOrder.length;
        completedForOrder.forEach(({ task }) => {
          setManifestItem(manifest, task.manifestKey, {
            status: "error",
            orderId: resolveId(order),
            fieldPath: task.fieldPath,
            oldUrl: task.sourceUrl,
            error: `save failed: ${error.message}`,
          });
        });
        console.error(
          `[orders] order save failed (${resolveId(order)}): ${error.message}`
        );
      }

      await saveManifest(manifestPath, manifest);
    }
  }

  if (!dryRun) {
    await saveManifest(manifestPath, manifest);
  }

  console.log(
    `Completed. migrated=${summary.migrated} skipped=${summary.skipped} errors=${summary.errors}`
  );

  if (summary.errors > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
