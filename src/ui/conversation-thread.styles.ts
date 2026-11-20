export const conversationThreadStyles = `
.omni-thread {
  --thread-text: #202631; --thread-muted: #556174; --thread-line: #dce2eb;
  --thread-bg: #fff; --thread-surface: #f5f7fa; --thread-out: #e8edff; --thread-out-line: #cdd8fa;
  --thread-accent: #3947ad; --thread-action: #3947ad; --thread-danger: #a22739;
  --thread-note: #fff8e6; --thread-note-text: #744716;
  color: var(--thread-text); background: var(--thread-bg); min-width: 0;
  width: 100%; container-type: inline-size; font: inherit;
}
.omni-thread[data-scheme="dark"] {
  --thread-text: #eef2f8; --thread-muted: #b5bfce; --thread-line: #394457;
  --thread-bg: #1b2029; --thread-surface: #242b38; --thread-out: #303b5e; --thread-out-line: #485783;
  --thread-accent: #aebaff; --thread-action: #5362ce; --thread-danger: #ffb3be;
  --thread-note: #392f27; --thread-note-text: #f5c382;
}
.omni-thread[data-popup="true"] {
  display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0;
}
.omni-thread .omni-thread-toolbar, .omni-thread .omni-thread-footer {
  display: flex; align-items: center; flex-wrap: wrap; justify-content: space-between;
  flex: none; gap: 8px 12px; padding: 10px 16px; border-bottom: 1px solid var(--thread-line);
}
.omni-thread .omni-thread-toolbar h2 { font-size: 15px; margin: 0; font-weight: 650; }
.omni-thread .omni-thread-footer { border-bottom: 0; border-top: 1px solid var(--thread-line); }
.omni-thread .omni-thread-footer small { color: var(--thread-muted); font-size: 12px; overflow-wrap: anywhere; }
.omni-thread .omni-thread-button {
  display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto;
  min-height: 34px; padding: 6px 11px; border: 1px solid var(--thread-line); border-radius: 7px;
  font: inherit; font-size: 13px; font-weight: 600; color: var(--thread-text);
  text-decoration: none; background: var(--thread-bg); cursor: pointer; box-sizing: border-box;
}
.omni-thread .omni-thread-button:hover { background: var(--thread-surface); }
.omni-thread .omni-thread-button[data-tone="primary"] { color: #fff; background: var(--thread-action); border-color: transparent; }
.omni-thread .omni-thread-button[data-tone="primary"]:hover { filter: brightness(1.14); }
.omni-thread .omni-thread-button[data-tone="danger"] { color: var(--thread-danger); }
.omni-thread .omni-thread-button:disabled { opacity: .56; cursor: default; }
.omni-thread .omni-thread-button:focus-visible, .omni-thread textarea:focus-visible,
.omni-thread summary:focus-visible { outline: 2px solid var(--thread-accent); outline-offset: 2px; }
.omni-thread[data-popup="true"] .omni-thread-history {
  /* Start at the latest message while keeping the inner list in chronological order. */
  display: flex; flex-direction: column-reverse;
  flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
  background: var(--thread-surface);
}
.omni-thread[data-popup="true"] .omni-thread-history-content { flex: none; margin-bottom: auto; }
.omni-thread .omni-thread-history:focus-visible { outline: 2px solid var(--thread-accent); outline-offset: -2px; }
.omni-thread .omni-thread-list {
  list-style: none; margin: 0; display: flex; flex-direction: column; gap: 12px;
  padding: 16px; min-width: 0;
}
.omni-thread .omni-thread-message {
  max-width: min(84%, 66ch); min-width: 0; align-self: flex-start; box-sizing: border-box;
  border: 1px solid var(--thread-line); border-radius: 12px; background: var(--thread-bg);
  padding: 10px 13px; overflow-wrap: anywhere;
}
.omni-thread .omni-thread-message[data-kind="inbound"] { border-bottom-left-radius: 4px; }
.omni-thread .omni-thread-message[data-kind="outbound"] {
  align-self: flex-end; border-color: var(--thread-out-line); border-bottom-right-radius: 4px; background: var(--thread-out);
}
.omni-thread .omni-thread-message:is([data-kind="proposal"], [data-kind="draft"], [data-kind="unknown"]) { align-self: center; }
.omni-thread .omni-thread-message[data-kind="proposal"] { max-width: min(100%, 66ch); width: 100%; }
.omni-thread .omni-thread-meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; font-size: 12px; line-height: 1.4; }
.omni-thread .omni-thread-meta strong { font-weight: 650; }
.omni-thread .omni-thread-direction, .omni-thread .omni-thread-time { color: var(--thread-muted); }
.omni-thread [data-kind="outbound"] :is(.omni-thread-direction, .omni-thread-time) { color: var(--thread-accent); }
.omni-thread .omni-thread-direction[data-failed="true"] { color: var(--thread-danger); }
.omni-thread .omni-thread-time {
  display: block; margin-top: 5px; text-align: end;
  font-size: 11px; font-variant-numeric: tabular-nums;
}
.omni-thread .omni-thread-text { font-size: 14px; line-height: 1.55; margin: 4px 0 0; white-space: pre-wrap; }
.omni-thread .omni-thread-tag {
  color: var(--thread-note-text); background: var(--thread-note); border-radius: 5px;
  padding: 2px 6px; font-size: 11px; font-weight: 650;
}
.omni-thread .omni-thread-editor { display: grid; gap: 9px; margin-top: 10px; }
.omni-thread .omni-thread-editor label { font-size: 13px; font-weight: 600; }
.omni-thread .omni-thread-editor textarea {
  background: var(--thread-bg); color: var(--thread-text); border: 1px solid var(--thread-line);
  border-radius: 7px; padding: 10px; font: inherit; font-size: 14px; line-height: 1.5;
  box-sizing: border-box; width: 100%; min-height: 112px; resize: vertical;
}
.omni-thread .omni-thread-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.omni-thread .omni-thread-hint, .omni-thread .omni-thread-error {
  margin: 0; color: var(--thread-muted); font-size: 13px; line-height: 1.5;
}
.omni-thread .omni-thread-error { color: var(--thread-danger); }
.omni-thread .omni-thread-state { padding: 14px 16px; }
.omni-thread .omni-thread-older { text-align: center; padding: 12px 16px 0; }
.omni-thread .omni-thread-media { display: grid; gap: 8px; margin-top: 10px; font-size: 13px; }
.omni-thread .omni-thread-media audio { width: 100%; max-width: 340px; }
.omni-thread .omni-thread-media a { color: var(--thread-accent); }
.omni-thread .omni-thread-media summary { cursor: pointer; width: fit-content; }
@container (max-width: 420px) {
  .omni-thread .omni-thread-list { padding: 12px; }
  .omni-thread .omni-thread-toolbar, .omni-thread .omni-thread-footer { padding-inline: 12px; }
  .omni-thread .omni-thread-message[data-kind]:not([data-kind="proposal"]) { max-width: 92%; }
}
`;
