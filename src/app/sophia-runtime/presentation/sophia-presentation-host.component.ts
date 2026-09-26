import { Component, Input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { SophiaPresentationMediaPolicy } from './sophia-presentation-media-policy';
import { SophiaToolPresentationRegistry } from './sophia-tool-presentation.registry';
import type {
  SophiaMediaGalleryBlock,
  SophiaPresentationAction,
  SophiaPresentationMedia,
} from './sophia-tool-presentation.types';

@Component({
  selector: 'app-sophia-presentation-host',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './sophia-presentation-host.component.html',
  styleUrls: ['./sophia-presentation-host.component.css'],
})
export class SophiaPresentationHostComponent {
  @Input() busy = false;
  private readonly failedMedia = new Set<string>();
  readonly selectedMedia = signal<SophiaPresentationMedia | null>(null);
  readonly document = this.presentation.document;

  constructor(
    readonly presentation: SophiaToolPresentationRegistry,
    private readonly mediaPolicy: SophiaPresentationMediaPolicy,
  ) {}

  run(action: SophiaPresentationAction): void {
    if (this.busy) return;
    void this.presentation.handleAction(action);
  }

  updateField(key: string, value: string): void {
    this.presentation.updateField(key, value);
  }

  async close(): Promise<void> {
    this.failedMedia.clear();
    this.selectedMedia.set(null);
    await this.presentation.dismiss();
  }

  openMedia(media: SophiaPresentationMedia): void {
    const safeMedia = this.safeMedia(media);
    if (safeMedia) this.selectedMedia.set(safeMedia);
  }

  mediaFailed(media: SophiaPresentationMedia): void {
    this.failedMedia.add(media.url);
    if (this.selectedMedia()?.url === media.url) this.selectedMedia.set(null);
  }

  visibleMedia(block: SophiaMediaGalleryBlock): SophiaPresentationMedia[] {
    return block.media
      .map((item) => this.safeMedia(item))
      .filter((item): item is SophiaPresentationMedia => item !== null);
  }

  safeMedia(media: SophiaPresentationMedia): SophiaPresentationMedia | null {
    if (this.failedMedia.has(media.url)) return null;
    const safeUrl = this.mediaPolicy.allow(media.url);
    return safeUrl ? { ...media, url: safeUrl } : null;
  }
}
