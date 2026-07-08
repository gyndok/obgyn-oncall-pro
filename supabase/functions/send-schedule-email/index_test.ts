import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { callFunction } from "../_shared/test-helpers.ts";

const FN = "send-schedule-email";

Deno.test(`${FN}: rejects request with no Authorization header`, async () => {
  const { status } = await callFunction(FN, { token: null, body: {} });
  assertEquals(status, 401);
});

Deno.test(`${FN}: rejects request with invalid bearer token`, async () => {
  const { status } = await callFunction(FN, {
    token: "not-a-real-jwt",
    body: {},
  });
  assertEquals(status, 401);
});
