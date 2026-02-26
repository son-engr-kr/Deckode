import { createContext, useContext, useState, useEffect } from "react";
import type { FileSystemAdapter } from "@/adapters/types";
import { assert } from "@/utils/assert";

const AdapterContext = createContext<FileSystemAdapter | null>(null);

export function AdapterProvider({
  adapter,
  children,
}: {
  adapter: FileSystemAdapter;
  children: React.ReactNode;
}) {
  return (
    <AdapterContext.Provider value={adapter}>
      {children}
    </AdapterContext.Provider>
  );
}

export function useAdapter(): FileSystemAdapter {
  const adapter = useContext(AdapterContext);
  assert(adapter !== null, "useAdapter must be used within <AdapterProvider>");
  return adapter;
}

/**
 * Returns true if the path is an external URL (http/https/blob/data) that
 * doesn't need adapter resolution.
 */
function isExternalUrl(path: string): boolean {
  return /^(https?:|blob:|data:)/.test(path);
}

/**
 * Resolves an asset path to a displayable URL.
 * External URLs (http, https, blob, data) are returned as-is.
 * In ViteApiAdapter: returns src unchanged (synchronous).
 * In FsAccessAdapter: reads the file and returns a cached blob URL (async).
 */
export function useAssetUrl(src: string | undefined): string | undefined {
  const adapter = useContext(AdapterContext);
  const [url, setUrl] = useState<string | undefined>(() => {
    if (!src || !adapter) return undefined;
    if (isExternalUrl(src)) return src;
    const result = adapter.resolveAssetUrl(src);
    if (typeof result === "string") return result;
    return undefined;
  });

  useEffect(() => {
    if (!src || !adapter) {
      setUrl(undefined);
      return;
    }

    if (isExternalUrl(src)) {
      setUrl(src);
      return;
    }

    const result = adapter.resolveAssetUrl(src);
    if (typeof result === "string") {
      setUrl(result);
    } else {
      result.then(setUrl);
    }
  }, [src, adapter]);

  return url;
}
