export const conversationThreadStyles = `
.omni-thread {
  --thread-text: #202631; --thread-muted: #556174; --thread-line: #dce2eb;
  --thread-bg: #fff; --thread-surface: #f5f7fa; --thread-out: #edf2ff;
  --thread-accent: #3947ad; --thread-action: #3947ad; --thread-danger: #a22739;
  --thread-note: #fff8e6; --thread-note-text: #744716;
  color: var(--thread-text); background: var(--thread-bg); min-width: 0;
  width: 100%; container-type: inline-size; font: inherit;
}
.omni-thread[data-scheme="dark"] {
  --thread-text: #eef2f8; --thread-muted: #b5bfce; --thread-line: #394457;
  --thread-bg: #1b2029; --thread-surface: #242b38; --thread-out: #282f4c;
  --thread-accent: #aebaff; --thread-action: #5362ce; --thread-danger: #ffb3be;
  --thread-note: #392f27; --thread-note-text: #f5c382;
}
.omni-thread .omni-thread-toolbar, .omni-thread .omni-thread-footer {
  display: flex; align-items: center; flex-wrap: wrap; justify-content: space-between;
  gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--thread-line);
}
.omni-thread .omni-thread-toolbar h2 { font-size: 15px; margin: 0; font-weight: 650; }
.omni-thread .omni-thread-footer { border-bottom: 0; border-top: 1px solid var(--thread-line); }
.omni-thread .omni-thread-toolbar small, .omni-thread .omni-thread-footer small,
.omni-thread .omni-thread-meta { color: var(--thread-muted); font-size: 12px; }
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
.omni-thread .omni-thread-list {
  list-style: none; margin: 0; display: flex; flex-direction: column; gap: 13px;
  padding: 16px; background: var(--thread-bg); min-width: 0;
}
.omni-thread .omni-thread-message {
  max-width: min(84%, 66ch); min-width: 0; align-self: flex-start; box-sizing: border-box;
  border: 1px solid var(--thread-line); border-radius: 11px; background: var(--thread-surface);
  padding: 10px 13px; overflow-wrap: anywhere;
}
.omni-thread .omni-thread-message[data-outbound="true"] { align-self: flex-end; background: var(--thread-out); }
.omni-thread .omni-thread-message[data-proposal="true"] { align-self: stretch; max-width: 74ch; width: 100%; background: var(--thread-bg); }
.omni-thread .omni-thread-meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; line-height: 1.45; }
.omni-thread .omni-thread-meta strong { color: var(--thread-text); }
.omni-thread .omni-thread-meta time { font-variant-numeric: tabular-nums; }
.omni-thread .omni-thread-text { font-size: 14px; line-height: 1.55; margin: 6px 0 0; white-space: pre-wrap; }
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
  .omni-thread .omni-thread-list { padding: 10px; }
  .omni-thread .omni-thread-message { max-width: 94%; }
}
`;
