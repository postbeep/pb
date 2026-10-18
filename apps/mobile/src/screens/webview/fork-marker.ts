export const FORK_MARKER = { backgroundAudio: true, version: 1 } as const;

const FORK_MARKER_SCRIPT = `
(function () {
  try {
    if (Object.prototype.hasOwnProperty.call(window, "bbFork")) return;
    Object.defineProperty(window, "bbFork", {
      value: Object.freeze(${JSON.stringify(FORK_MARKER)}),
    });
  } catch (error) {}
})();
true;
`;

export function withForkMarker(script: string): string {
  return `${script}\n${FORK_MARKER_SCRIPT}`;
}
