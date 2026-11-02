import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CornerDownLeft, Loader2 } from "lucide-react";
import { strFromU8, unzipSync } from "fflate";
import { SiteShell } from "~/components/site-shell";
import { WaitlistForm } from "~/components/waitlist-form";
import { pageMeta } from "~/meta";

type Platform = "ios" | "android" | "other";

function platformFromUserAgent(userAgent: string | undefined): Platform {
  const ua = userAgent ?? "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

const detectPlatform = createIsomorphicFn()
  .server(() => platformFromUserAgent(getRequestHeader("user-agent")))
  .client(() => platformFromUserAgent(navigator.userAgent));

export const Route = createFileRoute("/add-media-source")({
  validateSearch: (search: Record<string, unknown>): { url?: string; name?: string } => ({
    url: typeof search.url === "string" ? search.url : undefined,
    name: typeof search.name === "string" ? search.name : undefined,
  }),
  loader: () => ({
    platform: detectPlatform(),
  }),
  head: () =>
    pageMeta(
      "Add Media Source - Boppa",
      "Add a media source to Boppa.",
      "/add-media-source",
    ),
  component: AddSource,
});

function AddSource() {
  const { url, name } = Route.useSearch();
  const { platform } = Route.useLoaderData();
  const manifest = usePackageManifest(url);
  const displayName = manifest?.name ?? name;

  return (
    <SiteShell>
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-2">
        {url
          ? displayName
            ? `Add "${displayName}" Media Source?`
            : "Add Media Source?"
          : "Add Media Source"}
      </h1>

      <div className="mt-10">
        {!url ? (
          <GenerateLinkForm />
        ) : (
          <>
            {platform === "ios" && <IosPrompt url={url} />}
            {platform === "android" && <AndroidPrompt />}
            {platform === "other" && <DesktopPrompt url={url} />}
            <PackageDetails url={url} manifest={manifest} />
          </>
        )}
      </div>
    </SiteShell>
  );
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname.includes(".");
  } catch {
    return false;
  }
}

function withScheme(value: string): string {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value) ? value : `https://${value}`;
}

const MANIFEST_NAME = "manifest.json";

// A package's files sit at the root of the archive or inside a single top-level folder.
function findManifestPath(paths: string[]): string | undefined {
  const files = paths.filter(
    (path) =>
      !path.endsWith("/") &&
      path !== "boppa.json" &&
      !path.startsWith("__MACOSX/") &&
      !path.split("/").some((segment) => segment.startsWith(".")),
  );
  if (files.includes(MANIFEST_NAME)) return MANIFEST_NAME;

  const folders = new Set(files.map((path) => path.split("/")[0]));
  if (folders.size !== 1) return undefined;
  const nested = `${[...folders][0]}/${MANIFEST_NAME}`;
  return files.includes(nested) ? nested : undefined;
}

function readManifestText(archive: Uint8Array): string | undefined {
  const paths: string[] = [];
  unzipSync(archive, {
    filter: (file) => {
      paths.push(file.name);
      return false;
    },
  });
  const manifestPath = findManifestPath(paths);
  if (!manifestPath) return undefined;
  const files = unzipSync(archive, { filter: (file) => file.name === manifestPath });
  return strFromU8(files[manifestPath]);
}

type PackageManifest = {
  name: string;
  fqdn?: string;
  author?: string;
  gitUrl?: string;
};

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function parseManifest(value: unknown): PackageManifest | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const fields = value as Record<string, unknown>;
  const name = nonEmptyString(fields.name);
  if (!name) return undefined;
  return {
    name,
    fqdn: nonEmptyString(fields.fqdn),
    author: nonEmptyString(fields.author),
    gitUrl: nonEmptyString(fields.gitUrl),
  };
}

async function fetchPackageManifest(
  url: string,
): Promise<{ ok: true; manifest: PackageManifest } | { ok: false; message: string }> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return { ok: false, message: "Couldn't download this file. Make sure the URL is publicly accessible." };
  }
  if (!response.ok) {
    return { ok: false, message: "Couldn't download this file. Make sure the URL is publicly accessible." };
  }

  let manifestText: string | undefined;
  try {
    manifestText = readManifestText(new Uint8Array(await response.arrayBuffer()));
  } catch {
    return { ok: false, message: "This file isn't a valid media source package." };
  }
  if (manifestText === undefined) {
    return { ok: false, message: "This package is missing a manifest.json file." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(manifestText);
  } catch {
    return { ok: false, message: "This package's manifest.json isn't valid JSON." };
  }
  const manifest = parseManifest(parsed);
  if (!manifest) {
    return { ok: false, message: "This package's manifest.json is missing a name." };
  }

  return { ok: true, manifest };
}

async function validatePackageUrl(
  rawUrl: string,
): Promise<{ ok: true; url: string; name: string } | { ok: false; message: string }> {
  const withUrlScheme = withScheme(rawUrl);
  if (!isValidUrl(withUrlScheme)) {
    return { ok: false, message: "Please enter a valid URL." };
  }
  if (!/\.(boppa|zip)$/i.test(new URL(withUrlScheme).pathname)) {
    return { ok: false, message: "The URL must point to a .boppa or .zip file." };
  }

  const result = await fetchPackageManifest(withUrlScheme);
  if (!result.ok) return result;
  return { ok: true, url: withUrlScheme, name: result.manifest.name };
}

function usePackageManifest(url: string | undefined): PackageManifest | undefined {
  const [loaded, setLoaded] = useState<{ url: string; manifest: PackageManifest }>();

  useEffect(() => {
    if (!url) return;
    let isCancelled = false;
    fetchPackageManifest(url).then((result) => {
      if (!isCancelled && result.ok) setLoaded({ url, manifest: result.manifest });
    });
    return () => {
      isCancelled = true;
    };
  }, [url]);

  return loaded?.url === url ? loaded?.manifest : undefined;
}

function isGitHubUrl(gitUrl: string): boolean {
  try {
    const host = new URL(gitUrl).hostname.toLowerCase();
    return host === "github.com" || host === "www.github.com";
  } catch {
    return false;
  }
}

function gitUrlText(gitUrl: string): string {
  if (!isGitHubUrl(gitUrl)) return hidingScheme(gitUrl);
  const repo = new URL(gitUrl).pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "");
  return repo || hidingScheme(gitUrl);
}

function webUrl(value: string): string | undefined {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:" ? value : undefined;
  } catch {
    return undefined;
  }
}

function hidingScheme(url: string): string {
  const index = url.indexOf("://");
  return index === -1 ? url : url.slice(index + 3);
}

function redditProfileUrl(author: string): string | undefined {
  const username = /^\/?u\/([A-Za-z0-9_-]+)\/?$/i.exec(author)?.[1];
  return username ? `https://www.reddit.com/user/${username}` : undefined;
}

function DetailLink({ href, children }: { href: string | undefined; children: string }) {
  if (!href) return <>{children}</>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-foreground transition-colors"
    >
      {children}
    </a>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="font-bold">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

function PackageDetails({ url, manifest }: { url: string; manifest?: PackageManifest }) {
  const { fqdn, author, gitUrl } = manifest ?? {};

  return (
    <dl className="mt-10 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-3 text-sm text-muted-foreground">
      <DetailRow label="URL">
        <DetailLink href={webUrl(url)}>{hidingScheme(url)}</DetailLink>
      </DetailRow>
      {fqdn && (
        <DetailRow label="Media Source">
          <DetailLink href={webUrl(`https://${fqdn}`)}>{fqdn}</DetailLink>
        </DetailRow>
      )}
      {gitUrl && (
        <DetailRow label={isGitHubUrl(gitUrl) ? "GitHub" : "Git"}>
          <DetailLink href={webUrl(gitUrl)}>{gitUrlText(gitUrl)}</DetailLink>
        </DetailRow>
      )}
      {author && (
        <DetailRow label="Author">
          <DetailLink href={redditProfileUrl(author)}>{author}</DetailLink>
        </DetailRow>
      )}
    </dl>
  );
}

function GenerateLinkForm() {
  const navigate = useNavigate({ from: Route.fullPath });
  const [packageUrl, setPackageUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "invalid">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isInvalid = status === "invalid";

  return (
    <form
      ref={formRef}
      className="rounded-xl border border-border bg-card/40 p-6 md:p-8 space-y-4"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        const trimmed = packageUrl.trim();
        if (!trimmed) return;
        setStatus("loading");
        const result = await validatePackageUrl(trimmed);
        if (!result.ok) {
          setErrorMessage(result.message);
          setStatus("invalid");
          return;
        }
        navigate({ search: { url: result.url, name: result.name } });
      }}
    >
      <label
        htmlFor="package-url"
        className="block text-sm text-muted-foreground"
        onMouseDown={(event) => {
          event.preventDefault();
          if (document.activeElement === inputRef.current) {
            inputRef.current?.blur();
          }
        }}
        onClick={(event) => event.preventDefault()}
      >
        Paste a media source package URL to generate a link that adds it to
        Boppa.
      </label>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id="package-url"
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="https://media-sources.boppa.app/internet-archive.boppa"
          value={packageUrl}
          onChange={(event) => {
            setPackageUrl(event.target.value);
            if (isInvalid) setStatus("idle");
          }}
          aria-invalid={isInvalid}
          disabled={status === "loading"}
          className={`w-full rounded-lg border bg-background px-4 py-3 pr-12 text-base sm:text-sm text-foreground focus:outline-none disabled:opacity-50 ${
            isInvalid
              ? "border-red-500"
              : "border-border focus:border-primary"
          }`}
        />
        {isInvalid ? (
          <AlertCircle className="absolute right-3 w-4 h-4 text-red-500 pointer-events-none" />
        ) : (
          <button
            type="submit"
            aria-label="Generate link"
            disabled={!packageUrl.trim() || status === "loading"}
            className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {status === "loading" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CornerDownLeft className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
      {isInvalid && <p className="text-sm text-red-400">{errorMessage}</p>}
    </form>
  );
}

function IosPrompt({ url }: { url: string }) {
  const appLinkUrl = `boppa://add-media-source?url=${encodeURIComponent(url)}`;

  return (
    <section className="rounded-xl border border-border bg-card/40 p-6 md:p-8 space-y-4">
      <p className="text-sm text-muted-foreground">
        Open this link in Boppa to add this media source.
      </p>
      <a
        href={appLinkUrl}
        className="inline-flex items-center justify-center cursor-pointer rounded-lg border-2 border-primary bg-primary/10 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/30"
      >
        Open in Boppa
      </a>
      <p className="text-sm text-muted-foreground">
        Don&apos;t have the app yet?{" "}
        <Link to="/download" className="text-foreground underline underline-offset-2">
          Download Boppa
        </Link>
      </p>
    </section>
  );
}

function AndroidPrompt() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="rounded-xl border border-border bg-card/40 p-6 md:p-8 space-y-4">
      <p className="text-sm text-muted-foreground">
        The Boppa Android app isn&apos;t out yet, so this link can&apos;t open
        it directly.
      </p>
      <WaitlistForm platform="android" isOpen={isOpen} onOpen={() => setIsOpen(true)} />
    </section>
  );
}

function DesktopPrompt({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const canonicalUrl = `https://boppa.app/add-media-source?url=${encodeURIComponent(url)}`;

  return (
    <section className="rounded-xl border border-border bg-card/40 p-6 md:p-8 space-y-4">
      <p className="text-sm text-muted-foreground">
        This link is meant to be opened on your phone. Copy it and open it
        there.
      </p>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(canonicalUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 1000);
        }}
        className="inline-flex items-center justify-center cursor-pointer rounded-lg border-2 border-primary bg-primary/10 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/30"
      >
        {copied ? "Copied!" : "Copy Link"}
      </button>
      <Link
        to="/add-media-source"
        className="block w-fit text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Generate new link
      </Link>
    </section>
  );
}
