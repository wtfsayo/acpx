import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRequestedModelSupported,
  isRequestedModelUnsupportedError,
  REQUESTED_MODEL_UNSUPPORTED_ERROR_CODE,
  RequestedModelUnsupportedError,
} from "../src/acp/model-support.js";

test("Claude ACP model validation warns for unadvertised selectors", () => {
  const warning = assertRequestedModelSupported({
    requestedModel: "opus[1m]",
    models: {
      configId: "model",
      currentModelId: "sonnet",
      availableModels: [
        { modelId: "default", name: "Default" },
        { modelId: "sonnet", name: "Sonnet" },
      ],
    },
    agentCommand: "npx -y @agentclientprotocol/claude-agent-acp@^0.60.0",
    context: "apply",
  });

  assert.match(
    warning ?? "",
    /requested model "opus\[1m\]" was not in the Claude ACP advertised model list/,
  );
});

test("non-Claude model validation rejects unadvertised selectors", () => {
  assert.throws(() => {
    try {
      assertRequestedModelSupported({
        requestedModel: "missing-model",
        models: {
          configId: "model",
          currentModelId: "default",
          availableModels: [{ modelId: "default", name: "Default" }],
        },
        agentCommand: "mock-agent --advertise-models",
        context: "apply",
      });
    } catch (error) {
      assert(error instanceof RequestedModelUnsupportedError);
      assert.equal(error.code, REQUESTED_MODEL_UNSUPPORTED_ERROR_CODE);
      assert.equal(error.reason, "unadvertised-model");
      assert.equal(isRequestedModelUnsupportedError(error), true);
      assert.equal(
        isRequestedModelUnsupportedError({
          name: "RequestedModelUnsupportedError",
          code: REQUESTED_MODEL_UNSUPPORTED_ERROR_CODE,
          reason: "unadvertised-model",
        }),
        true,
      );
      throw error;
    }
  }, /did not advertise that model/);
});

test("model validation distinguishes missing model capability", () => {
  assert.throws(
    () =>
      assertRequestedModelSupported({
        requestedModel: "missing-model",
        models: undefined,
        agentCommand: "mock-agent",
        context: "apply",
      }),
    (error: unknown) => {
      assert(error instanceof RequestedModelUnsupportedError);
      assert.equal(error.reason, "missing-capability");
      assert.equal(isRequestedModelUnsupportedError(error), true);
      return error.message.includes("did not advertise model support");
    },
  );
});

test("Devin model validation defers to the startup model flag", () => {
  for (const context of ["apply", "replay"] as const) {
    const warning = assertRequestedModelSupported({
      requestedModel: "swe-2-high",
      models: undefined,
      agentCommand: "devin acp",
      context,
    });
    assert.equal(warning, undefined);
  }
});

test("Devin model validation warns instead of rejecting unadvertised fuzzy names", () => {
  const warning = assertRequestedModelSupported({
    requestedModel: "SWE-2 High",
    models: {
      configId: "model",
      currentModelId: "swe-2-high",
      availableModels: [{ modelId: "swe-2-high", name: "SWE-2 High" }],
    },
    agentCommand: "devin acp",
    context: "apply",
  });

  assert.match(warning ?? "", /passed to the agent as a startup flag/);
});

test("model unsupported predicate rejects unrelated errors", () => {
  assert.equal(isRequestedModelUnsupportedError(new Error("did not advertise that model")), false);
  assert.equal(
    isRequestedModelUnsupportedError({
      name: "RequestedModelUnsupportedError",
      code: "ACP_TURN_FAILED",
      reason: "missing-capability",
    }),
    false,
  );
  assert.equal(
    isRequestedModelUnsupportedError({
      name: "RequestedModelUnsupportedError",
      code: REQUESTED_MODEL_UNSUPPORTED_ERROR_CODE,
      reason: "unknown",
    }),
    false,
  );
});

test("Cursor model validation accepts a unique advertised suffix variant", () => {
  const warning = assertRequestedModelSupported({
    requestedModel: "composer-2.5",
    models: {
      configId: "model",
      currentModelId: "composer-2.5[fast=false]",
      availableModels: [{ modelId: "composer-2.5[fast=false]", name: "Composer 2.5" }],
    },
    agentCommand: "cursor-agent acp",
    context: "apply",
  });

  assert.match(warning ?? "", /advertised "composer-2\.5\[fast=false\]"/);
});

test("Cursor model validation keeps ambiguous suffix variants strict", () => {
  assert.throws(
    () =>
      assertRequestedModelSupported({
        requestedModel: "composer-2.5",
        models: {
          configId: "model",
          currentModelId: "composer-2.5[fast=false]",
          availableModels: [
            { modelId: "composer-2.5[fast=false]", name: "Composer 2.5" },
            { modelId: "composer-2.5[fast=true]", name: "Composer 2.5 Fast" },
          ],
        },
        agentCommand: "cursor-agent acp",
        context: "apply",
      }),
    /did not advertise that model/,
  );
});

test("Cursor model resolution preserves an exact advertised id", () => {
  const warning = assertRequestedModelSupported({
    requestedModel: "composer-2.5",
    models: {
      configId: "model",
      currentModelId: "composer-2.5",
      availableModels: [
        { modelId: "composer-2.5", name: "Composer 2.5" },
        { modelId: "composer-2.5[fast=false]", name: "Composer 2.5 Fast" },
      ],
    },
    agentCommand: "cursor-agent acp",
    context: "apply",
  });

  assert.equal(warning, undefined);
});
