import { useCallback, useState } from 'react';
import { upload } from '@/services/api';
import type { PendingUpload } from '@/components/owner/MediaManager';
import { classifyFile } from '@/components/owner/MediaManager';

/**
 * Uploads files one at a time so each gets its own progress bar and a failure
 * on one file doesn't lose the rest.
 */
export function useUploader<T>() {
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const run = useCallback(async (path: string, field: string, files: File[], onEach: (res: T) => void) => {
    const jobs = files.map((f, i) => ({ f, key: `${Date.now()}-${i}-${f.name}`, kind: classifyFile(f) || 'image' }));
    setPending((p) => [...p, ...jobs.map((j) => ({ key: j.key, name: j.f.name, kind: j.kind, progress: 0, preview: j.kind === 'image' ? URL.createObjectURL(j.f) : undefined }))]);
    let ok = 0;
    const errors: string[] = [];
    for (const j of jobs) {
      const fd = new FormData();
      fd.append(field, j.f);
      try {
        const res = await upload<T>(path, fd, (pct) => setPending((p) => p.map((x) => (x.key === j.key ? { ...x, progress: pct } : x))));
        onEach(res);
        ok++;
        setPending((p) => p.filter((x) => x.key !== j.key));
      } catch (e: any) {
        errors.push(`${j.f.name}: ${e.message}`);
        setPending((p) => p.map((x) => (x.key === j.key ? { ...x, error: e.message } : x)));
        setTimeout(() => setPending((p) => p.filter((x) => x.key !== j.key)), 5000);
      }
    }
    return { ok, errors };
  }, []);
  return { pending, run };
}
