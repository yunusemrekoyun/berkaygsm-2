import { handleApi } from "../../../server/handleApi.js";

export const runtime = "nodejs";

export async function GET(request, context) {
  return handleApi(request, context);
}

export async function POST(request, context) {
  return handleApi(request, context);
}

export async function PUT(request, context) {
  return handleApi(request, context);
}

export async function PATCH(request, context) {
  return handleApi(request, context);
}

export async function DELETE(request, context) {
  return handleApi(request, context);
}
