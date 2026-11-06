// Shared by the server importer and the upload UI (kept separate so the
// browser bundle doesn't pull in the server-side parsers).
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const SUPPORTED_EXTENSIONS = [".txt", ".md", ".markdown", ".docx"] as const;
export const SUPPORTED_LABEL = ".txt, .md or .docx (up to 5 MB)";
