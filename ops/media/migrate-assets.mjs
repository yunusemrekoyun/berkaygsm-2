import About from "../../src/server/models/About.js";
import Campaign from "../../src/server/models/Campaign.js";
import Category from "../../src/server/models/Category.js";
import ContactConfig from "../../src/server/models/ContactConfig.js";
import Hero from "../../src/server/models/Hero.js";
import Product from "../../src/server/models/Product.js";
import ServiceRecord from "../../src/server/models/ServiceRecord.js";
import SetModel from "../../src/server/models/Set.js";
import UserDetails from "../../src/server/models/UserDetails.js";
import { localProvider } from "../../src/server/media/providers/localProvider.js";
import {
  bootstrapRuntime,
  downloadAsset,
  getManifestItem,
  isManagedMediaUrl,
  loadManifest,
  parseBooleanArg,
  parseCliArgs,
  parseListArg,
  parsePositiveInt,
  printScriptHeader,
  resolveManifestPath,
  saveManifest,
  setManifestItem,
  toStoredMedia,
} from "./shared.mjs";

function resolveId(doc) {
  return doc?._id?.toString?.() || String(doc?._id || "");
}

function createTask({
  collection,
  docId,
  fieldPath,
  source,
  resourceType = "image",
  targetPublicId,
  apply,
}) {
  return {
    collection,
    docId,
    fieldPath,
    source,
    resourceType,
    targetPublicId,
    manifestKey: `${collection}:${docId}:${fieldPath}`,
    apply,
  };
}

function buildCollections() {
  return [
    {
      key: "products",
      cursor: () => Product.find({}, "_id images").cursor(),
      buildTasks(doc) {
        const docId = resolveId(doc);
        return (doc.images || []).map((image, index) =>
          createTask({
            collection: "products",
            docId,
            fieldPath: `images.${index}`,
            source: image,
            targetPublicId: `products/${docId}/image-${index + 1}`,
            apply(asset) {
              doc.images[index] = toStoredMedia(asset);
            },
          })
        );
      },
    },
    {
      key: "sets",
      cursor: () => SetModel.find({}, "_id images").cursor(),
      buildTasks(doc) {
        const docId = resolveId(doc);
        return (doc.images || []).map((image, index) =>
          createTask({
            collection: "sets",
            docId,
            fieldPath: `images.${index}`,
            source: image,
            targetPublicId: `sets/${docId}/image-${index + 1}`,
            apply(asset) {
              doc.images[index] = toStoredMedia(asset);
            },
          })
        );
      },
    },
    {
      key: "categories",
      cursor: () => Category.find({}, "_id image").cursor(),
      buildTasks(doc) {
        const docId = resolveId(doc);
        if (!doc.image?.url) return [];
        return [
          createTask({
            collection: "categories",
            docId,
            fieldPath: "image",
            source: doc.image,
            targetPublicId: `categories/${docId}/image`,
            apply(asset) {
              doc.image = toStoredMedia(asset);
            },
          }),
        ];
      },
    },
    {
      key: "campaigns",
      cursor: () => Campaign.find({}, "_id image").cursor(),
      buildTasks(doc) {
        const docId = resolveId(doc);
        if (!doc.image?.url) return [];
        return [
          createTask({
            collection: "campaigns",
            docId,
            fieldPath: "image",
            source: doc.image,
            targetPublicId: `campaigns/${docId}/image`,
            apply(asset) {
              doc.image = toStoredMedia(asset);
            },
          }),
        ];
      },
    },
    {
      key: "heroes",
      cursor: () => Hero.find({}, "_id image video").cursor(),
      buildTasks(doc) {
        const docId = resolveId(doc);
        const tasks = [];
        if (doc.image?.url) {
          tasks.push(
            createTask({
              collection: "heroes",
              docId,
              fieldPath: "image",
              source: doc.image,
              targetPublicId: `heroes/${docId}/image`,
              apply(asset) {
                doc.image = toStoredMedia(asset);
              },
            })
          );
        }
        if (doc.video?.url) {
          tasks.push(
            createTask({
              collection: "heroes",
              docId,
              fieldPath: "video",
              source: doc.video,
              resourceType: "video",
              targetPublicId: `heroes/${docId}/video`,
              apply(asset) {
                doc.video = toStoredMedia(asset, {
                  includeDuration: true,
                  includePoster: true,
                });
              },
            })
          );
        }
        return tasks;
      },
    },
    {
      key: "about",
      cursor: () =>
        About.find({}, "_id heroImage leftImage materialsImage key").cursor(),
      buildTasks(doc) {
        const docId = resolveId(doc);
        const tasks = [];
        const mappings = [
          ["heroImage", "hero-image"],
          ["leftImage", "left-image"],
          ["materialsImage", "materials-image"],
        ];
        mappings.forEach(([field, suffix]) => {
          if (!doc[field]?.url) return;
          tasks.push(
            createTask({
              collection: "about",
              docId,
              fieldPath: field,
              source: doc[field],
              targetPublicId: `about/${docId}/${suffix}`,
              apply(asset) {
                doc[field] = toStoredMedia(asset);
              },
            })
          );
        });
        return tasks;
      },
    },
    {
      key: "contact",
      cursor: () => ContactConfig.find({}, "_id heroImage key").cursor(),
      buildTasks(doc) {
        const docId = resolveId(doc);
        if (!doc.heroImage?.url) return [];
        return [
          createTask({
            collection: "contact",
            docId,
            fieldPath: "heroImage",
            source: doc.heroImage,
            targetPublicId: `contact/${docId}/hero-image`,
            apply(asset) {
              doc.heroImage = toStoredMedia(asset);
            },
          }),
        ];
      },
    },
    {
      key: "service-records",
      cursor: () => ServiceRecord.find({ isDeleted: false }, "_id images").cursor(),
      buildTasks(doc) {
        const docId = resolveId(doc);
        return (doc.images || []).map((image, index) =>
          createTask({
            collection: "service-records",
            docId,
            fieldPath: `images.${index}`,
            source: image,
            targetPublicId: `service-records/${docId}/image-${index + 1}`,
            apply(asset) {
              doc.images[index] = toStoredMedia(asset, {
                includeBytes: true,
                includeResourceType: true,
              });
            },
          })
        );
      },
    },
    {
      key: "avatars",
      cursor: () => UserDetails.find({}, "_id avatar").cursor(),
      buildTasks(doc) {
        const docId = resolveId(doc);
        if (!doc.avatar?.url) return [];
        return [
          createTask({
            collection: "avatars",
            docId,
            fieldPath: "avatar",
            source: doc.avatar,
            targetPublicId: `avatars/${docId}/avatar`,
            apply(asset) {
              doc.avatar = toStoredMedia(asset);
            },
          }),
        ];
      },
    },
  ];
}

function shouldSkipTask(task, manifest) {
  const sourceUrl = task.source?.url || "";
  if (!sourceUrl) return { skip: true, reason: "missing_url" };
  if (isManagedMediaUrl(sourceUrl)) {
    return { skip: true, reason: "already_managed" };
  }
  const manifestItem = getManifestItem(manifest, task.manifestKey);
  if (manifestItem?.status === "done") {
    return { skip: true, reason: "manifest_done" };
  }
  return { skip: false };
}

async function migrateTask(task, { dryRun, manifest }) {
  const sourceUrl = task.source.url;

  if (dryRun) {
    return {
      planned: true,
      asset: {
        url: sourceUrl,
        publicId: task.targetPublicId,
      },
    };
  }

  const download = await downloadAsset(sourceUrl);
  const migrated = await localProvider.uploadBuffer(download.buffer, {
    folder: task.collection,
    publicId: task.targetPublicId,
    resourceType: task.resourceType,
    mimeType: download.mimeType,
    originalName: download.originalName,
  });

  setManifestItem(manifest, task.manifestKey, {
    status: "uploaded",
    collection: task.collection,
    documentId: task.docId,
    fieldPath: task.fieldPath,
    oldUrl: sourceUrl,
    newUrl: migrated.url,
    publicId: migrated.publicId,
  });

  return { planned: false, asset: migrated };
}

function printHelp() {
  console.log(`Usage: node ops/media/migrate-assets.mjs [options]

Options:
  --env <path>         Env file path
  --manifest <path>    Manifest JSON path
  --only <list>        Comma-separated collections
  --limit <n>          Max migrated asset count
  --dry-run            Print plan without mutating DB
  --help               Show this help

Collections:
  products, sets, categories, campaigns, heroes, about, contact, service-records, avatars
`);
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
    "media-migration-manifest.json"
  );
  const dryRun = parseBooleanArg(args["dry-run"], false);
  const limit = parsePositiveInt(args.limit, null);
  const only = new Set(parseListArg(args.only));

  const { envFile: loadedEnvFile } = await bootstrapRuntime({ envFile });
  const manifest = await loadManifest(manifestPath);
  const collections = buildCollections().filter((collection) =>
    only.size ? only.has(collection.key) : true
  );

  printScriptHeader("Media Asset Migration", {
    envFile: loadedEnvFile || "not-found",
    manifestPath,
    dryRun,
    limit: limit ?? "none",
    collections: collections.map((item) => item.key).join(", "),
  });

  const summary = {
    migrated: 0,
    skipped: 0,
    errors: 0,
  };

  outer: for (const collection of collections) {
    for await (const doc of collection.cursor()) {
      const tasks = collection.buildTasks(doc);
      const completedForDoc = [];
      let mutated = false;

      for (const task of tasks) {
        if (limit != null && summary.migrated >= limit) {
          break outer;
        }

        const skip = shouldSkipTask(task, manifest);
        if (skip.skip) {
          summary.skipped += 1;
          continue;
        }

        try {
          const result = await migrateTask(task, { dryRun, manifest });
          if (!result.planned) {
            task.apply(result.asset);
            completedForDoc.push({
              task,
              asset: result.asset,
            });
            mutated = true;
          }
          summary.migrated += 1;
          console.log(
            `[${collection.key}] ${task.fieldPath} -> ${task.targetPublicId}${
              dryRun ? " (dry-run)" : ""
            }`
          );
        } catch (error) {
          summary.errors += 1;
          setManifestItem(manifest, task.manifestKey, {
            status: "error",
            collection: task.collection,
            documentId: task.docId,
            fieldPath: task.fieldPath,
            oldUrl: task.source?.url || "",
            error: error.message,
          });
          console.error(
            `[${collection.key}] ${task.fieldPath} failed: ${error.message}`
          );
          await saveManifest(manifestPath, manifest);
        }
      }

      if (!dryRun && mutated) {
        try {
          await doc.save();
          completedForDoc.forEach(({ task, asset }) => {
            setManifestItem(manifest, task.manifestKey, {
              status: "done",
              collection: task.collection,
              documentId: task.docId,
              fieldPath: task.fieldPath,
              oldUrl: task.source?.url || "",
              newUrl: asset.url,
              publicId: asset.publicId,
            });
          });
        } catch (error) {
          summary.errors += completedForDoc.length;
          completedForDoc.forEach(({ task }) => {
            setManifestItem(manifest, task.manifestKey, {
              status: "error",
              collection: task.collection,
              documentId: task.docId,
              fieldPath: task.fieldPath,
              oldUrl: task.source?.url || "",
              error: `save failed: ${error.message}`,
            });
          });
          console.error(
            `[${collection.key}] document save failed (${resolveId(doc)}): ${error.message}`
          );
        }

        await saveManifest(manifestPath, manifest);
      }
    }
  }

  if (dryRun) {
    console.log("Dry run completed.");
    return;
  }

  await saveManifest(manifestPath, manifest);

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
