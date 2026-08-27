import type { Notice } from "../../data/types";
import { activeNotices } from "../../domain/notices/active";
import { applyNoticeLayout } from "../layout";
import { clearNoticeFitCache, fitNoticeToPages, type NoticePage } from "../text-fit";
import { clearElement, createElement, requireElement, setText } from "../dom";
import type { Panel } from "./panel";

const TYPE_LABELS: Record<string, string> = {
  info: "Info",
  warning: "Tähelepanu",
  danger: "Oluline",
  success: "Tehtud",
};

export interface NoticesSlice {
  items: Notice[];
  now: Date;
  rotationMs: number;
}

export class NoticesPanel implements Panel<NoticesSlice> {
  private area!: HTMLElement;
  private pager!: HTMLElement;
  private pageLabel!: HTMLElement;
  private card!: HTMLElement;
  private metaType!: HTMLElement;
  private title!: HTMLElement;
  private body!: HTMLElement;
  private pageCount!: HTMLElement;
  private mounted = false;
  private notices: Notice[] = [];
  private noticeIndex = 0;
  private pageIndex = 0;
  private pages: NoticePage[] = [];
  private nextRotationAt = 0;
  private rotationMs = 14_000;
  private currentNoticeId = "";

  mount(): void {
    if (this.mounted) return;
    this.area = requireElement("noticeArea");
    this.pager = requireElement("noticePager");
    this.pageLabel = requireElement("noticePageLabel");
    this.card = createElement("article", "notice-card");
    const meta = createElement("div", "notice-meta numeric");
    this.metaType = createElement("span");
    meta.appendChild(this.metaType);
    this.title = createElement("h3", "notice-title");
    this.body = createElement("div", "notice-body");
    this.pageCount = createElement("div", "notice-page-count numeric");
    this.card.append(meta, this.title, this.body, this.pageCount);
    this.area.appendChild(this.card);
    this.mounted = true;
  }

  update(slice: NoticesSlice): void {
    this.mount();
    this.rotationMs = Math.max(6_000, slice.rotationMs);
    const next = activeNotices(slice.items, slice.now);
    applyNoticeLayout(next.length > 0);
    if (!next.length) {
      this.notices = [];
      this.noticeIndex = 0;
      this.pageIndex = 0;
      this.pages = [];
      this.currentNoticeId = "";
      this.card.hidden = true;
      clearElement(this.pager);
      setText(this.pageLabel, "");
      return;
    }

    const previousId = this.currentNoticeId;
    this.notices = next;
    const found = previousId ? next.findIndex((notice) => notice.id === previousId) : -1;
    if (found >= 0) this.noticeIndex = found;
    this.noticeIndex = Math.min(this.noticeIndex, next.length - 1);
    const selected = next[this.noticeIndex]!;
    if (selected.id !== previousId) this.pageIndex = 0;
    this.currentNoticeId = selected.id;
    this.card.hidden = false;
    this.renderSelected(true);
    if (!this.nextRotationAt) this.nextRotationAt = slice.now.getTime() + this.rotationMs;
  }

  tick(now: Date): void {
    if (!this.notices.length || now.getTime() < this.nextRotationAt) return;
    if (this.pageIndex + 1 < this.pages.length) {
      this.pageIndex += 1;
    } else {
      this.pageIndex = 0;
      this.noticeIndex = (this.noticeIndex + 1) % this.notices.length;
      this.currentNoticeId = this.notices[this.noticeIndex]?.id ?? "";
    }
    this.nextRotationAt = now.getTime() + this.rotationMs;
    this.renderSelected(this.pageIndex === 0);
  }

  invalidateLayout(): void {
    clearNoticeFitCache();
    if (this.notices.length) this.renderSelected(true);
  }

  destroy(): void {
    this.card?.remove();
    this.mounted = false;
  }

  private renderSelected(remeasure: boolean): void {
    const notice = this.notices[this.noticeIndex];
    if (!notice) return;
    this.card.dataset.type = notice.type || "info";
    setText(this.metaType, TYPE_LABELS[notice.type] ?? "Info");
    setText(this.title, notice.title || "Info");
    if (remeasure || !this.pages.length) {
      setText(this.body, notice.body || "");
      this.body.style.fontSize = "";
      this.pages = fitNoticeToPages(notice, this.card, this.body);
      this.pageIndex = Math.min(this.pageIndex, Math.max(0, this.pages.length - 1));
    }
    const page = this.pages[this.pageIndex] ?? { text: notice.body || "", fontPx: 20 };
    setText(this.body, page.text);
    this.body.style.fontSize = `${page.fontPx}px`;
    setText(this.pageCount, this.pages.length > 1 ? `lk ${this.pageIndex + 1}/${this.pages.length}` : "");
    setText(this.pageLabel, this.notices.length > 1 ? `${this.noticeIndex + 1}/${this.notices.length}` : "");
    this.renderPager();
  }

  private renderPager(): void {
    clearElement(this.pager);
    if (this.notices.length <= 1) return;
    for (let index = 0; index < this.notices.length; index += 1) {
      const dot = createElement("span", `pager-dot${index === this.noticeIndex ? " active" : ""}`);
      this.pager.appendChild(dot);
    }
  }
}
