/**
 * Site-wide constants. Set VITE_REPO_URL (e.g. in .env or the CI environment) to the public repository URL;
 * until then, repository links are hidden rather than pointing somewhere wrong.
 */
export const REPO_URL: string = (import.meta.env.VITE_REPO_URL as string | undefined) ?? 'https://github.com/nbanihasan/beamwise';
export const SITE_NAME = 'Beamwise';
