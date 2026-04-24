import { parseRegistryNpmSpec, type ParsedRegistryNpmSpec } from "../infra/npm-registry-spec.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import type { PluginPackageInstall } from "./manifest.js";

export type PluginInstallSourceWarning =
  | "invalid-npm-spec"
  | "npm-spec-floating"
  | "npm-spec-missing-integrity"
  | "npm-spec-package-name-mismatch";

export type PluginInstallNpmPinState =
  | "exact-with-integrity"
  | "exact-without-integrity"
  | "floating-with-integrity"
  | "floating-without-integrity";

export type PluginInstallNpmSourceInfo = {
  spec: string;
  packageName: string;
  expectedPackageName?: string;
  selector?: string;
  selectorKind: ParsedRegistryNpmSpec["selectorKind"];
  exactVersion: boolean;
  expectedIntegrity?: string;
  pinState: PluginInstallNpmPinState;
};

export type PluginInstallLocalSourceInfo = {
  path: string;
};

export type PluginInstallSourceInfo = {
  defaultChoice?: PluginPackageInstall["defaultChoice"];
  npm?: PluginInstallNpmSourceInfo;
  local?: PluginInstallLocalSourceInfo;
  warnings: readonly PluginInstallSourceWarning[];
};

export type DescribePluginInstallSourceOptions = {
  expectedPackageName?: string | null;
};

function resolveNpmPinState(params: {
  exactVersion: boolean;
  hasIntegrity: boolean;
}): PluginInstallNpmPinState {
  if (params.exactVersion) {
    return params.hasIntegrity ? "exact-with-integrity" : "exact-without-integrity";
  }
  return params.hasIntegrity ? "floating-with-integrity" : "floating-without-integrity";
}

function normalizeExpectedPackageName(value: string | null | undefined): string | undefined {
  const expected = normalizeOptionalString(value);
  if (!expected) {
    return undefined;
  }
  return parseRegistryNpmSpec(expected)?.name ?? expected;
}

export function describePluginInstallSource(
  install: PluginPackageInstall,
  options?: DescribePluginInstallSourceOptions,
): PluginInstallSourceInfo {
  const npmSpec = normalizeOptionalString(install.npmSpec);
  const localPath = normalizeOptionalString(install.localPath);
  const expectedPackageName = normalizeExpectedPackageName(options?.expectedPackageName);
  const defaultChoice =
    install.defaultChoice === "npm" || install.defaultChoice === "local"
      ? install.defaultChoice
      : undefined;
  const warnings: PluginInstallSourceWarning[] = [];
  let npm: PluginInstallNpmSourceInfo | undefined;

  if (npmSpec) {
    const parsed = parseRegistryNpmSpec(npmSpec);
    if (parsed) {
      const exactVersion = parsed.selectorKind === "exact-version";
      const expectedIntegrity = normalizeOptionalString(install.expectedIntegrity);
      const hasIntegrity = Boolean(expectedIntegrity);
      if (!exactVersion) {
        warnings.push("npm-spec-floating");
      }
      if (!hasIntegrity) {
        warnings.push("npm-spec-missing-integrity");
      }
      if (expectedPackageName && parsed.name !== expectedPackageName) {
        warnings.push("npm-spec-package-name-mismatch");
      }
      npm = {
        spec: parsed.raw,
        packageName: parsed.name,
        ...(expectedPackageName && parsed.name !== expectedPackageName
          ? { expectedPackageName }
          : {}),
        selectorKind: parsed.selectorKind,
        exactVersion,
        pinState: resolveNpmPinState({ exactVersion, hasIntegrity }),
        ...(parsed.selector ? { selector: parsed.selector } : {}),
        ...(expectedIntegrity ? { expectedIntegrity } : {}),
      };
    } else {
      warnings.push("invalid-npm-spec");
    }
  }

  return {
    ...(defaultChoice ? { defaultChoice } : {}),
    ...(npm ? { npm } : {}),
    ...(localPath ? { local: { path: localPath } } : {}),
    warnings,
  };
}
