import { useEffect, useState } from "react";
import { loadAssetRegistry, type AssetRegistry } from "./assetRegistry";

type AssetRegistryLoadState = {
  readonly status: "idle" | "loading" | "ready" | "error";
  readonly registry: AssetRegistry | null;
  readonly error: string | null;
};

const initialState: AssetRegistryLoadState = {
  status: "idle",
  registry: null,
  error: null
};

export function useAssetRegistry(): AssetRegistryLoadState {
  const [state, setState] = useState<AssetRegistryLoadState>(initialState);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading", registry: null, error: null });

    void loadAssetRegistry()
      .then((registry) => {
        if (alive) setState({ status: "ready", registry, error: null });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setState({
          status: "error",
          registry: null,
          error: error instanceof Error ? error.message : "资产 manifest 读取失败。"
        });
      });

    return () => {
      alive = false;
    };
  }, []);

  return state;
}
