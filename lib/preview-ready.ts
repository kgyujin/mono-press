/**
 * 작성자: Git 이력 참조
 * 작성목적: PDF 출력 전에 이미지 디코딩과 글꼴 준비를 제한 시간 내에 확인한다.
 * 작성일: 2026-10-08
 * 변경사항 내역:
 * - 2026-10-08 | 출력 정합성 개선 | 공통 인쇄 스타일 및 출력 리소스 준비 지원
 */
export async function waitForPreviewAssets(
  preview: HTMLElement,
  timeoutMs = 15_000,
): Promise<void> {
  const cleanups: Array<() => void> = [];
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const images = Array.from(preview.querySelectorAll<HTMLImageElement>('img[src]'));
  const imageLoads = images.map(async (image) => {
    // Lazy images outside the viewport still need to appear in the printed pages.
    image.loading = 'eager';
    if (!image.complete) {
      await new Promise<void>((resolve, reject) => {
        const removeListeners = () => {
          image.removeEventListener('load', loaded);
          image.removeEventListener('error', failed);
        };
        const loaded = () => { removeListeners(); resolve(); };
        const failed = () => { removeListeners(); reject(new Error('이미지를 불러오지 못했습니다. 이미지 경로나 네트워크 연결을 확인해 주세요.')); };
        cleanups.push(removeListeners);
        image.addEventListener('load', loaded, { once: true });
        image.addEventListener('error', failed, { once: true });
      });
    }
    if (!image.naturalWidth) {
      throw new Error('이미지를 불러오지 못했습니다. 이미지 경로나 네트워크 연결을 확인해 주세요.');
    }
    await image.decode();
  });
  try {
    await Promise.race([
      Promise.all([...imageLoads, preview.ownerDocument.fonts?.ready]),
      new Promise<never>((_, reject) => {
        deadline = setTimeout(() => reject(new Error('이미지와 글꼴 준비 시간이 초과되었습니다. 잠시 후 다시 출력해 주세요.')), timeoutMs);
      }),
    ]);
  } finally {
    if (deadline !== undefined) clearTimeout(deadline);
    cleanups.forEach((cleanup) => cleanup());
  }
}
