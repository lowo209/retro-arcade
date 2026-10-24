import fs from 'node:fs';
import crypto from 'node:crypto';

// Match the uploader's fixed 32 MiB multipart threshold and part size.
export const PART_BYTES = 32 * 1024 * 1024;
export const multipartETag = parts => `${crypto.createHash('md5').update(Buffer.concat(parts)).digest('hex')}-${parts.length}`;
export async function hashUploadFile(file, partSize = PART_BYTES) {
  const sha = crypto.createHash('sha256'), whole = crypto.createHash('md5'), parts = [];
  let part = crypto.createHash('md5'), partBytes = 0, bytes = 0;
  for await (const block of fs.createReadStream(file)) {
    sha.update(block); whole.update(block); bytes += block.length;
    for (let offset = 0; offset < block.length;) {
      const end = Math.min(block.length, offset + partSize - partBytes);
      part.update(block.subarray(offset, end)); partBytes += end - offset; offset = end;
      if (partBytes === partSize) { parts.push(part.digest()); part = crypto.createHash('md5'); partBytes = 0; }
    }
  }
  if (partBytes) parts.push(part.digest());
  return { bytes, sha256: sha.digest('hex'), etag: bytes >= partSize ? multipartETag(parts) : whole.digest('hex') };
}
