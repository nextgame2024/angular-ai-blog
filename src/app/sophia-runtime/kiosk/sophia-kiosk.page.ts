import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { SophiaPresentationHostComponent } from '../presentation/sophia-presentation-host.component';
import { SophiaToolPresentationRegistry } from '../presentation/sophia-tool-presentation.registry';
import {
  SophiaSessionFacade,
  type SophiaSessionToolCall,
} from '../services/sophia-session.facade';
import type { SophiaExperience } from '../types/sophia-runtime.types';

@Component({
  selector: 'app-sophia-kiosk-page',
  imports: [CommonModule, FormsModule, SophiaPresentationHostComponent],
  templateUrl: './sophia-kiosk.page.html',
  styleUrls: ['./sophia-kiosk.page.css'],
})
export class SophiaKioskPageComponent implements OnInit, OnDestroy {
  private readonly sessionFacade = inject(SophiaSessionFacade);
  private readonly presentation = inject(SophiaToolPresentationRegistry);

  @ViewChild('remoteAudio')
  private readonly remoteAudio?: ElementRef<HTMLAudioElement>;
  @ViewChild('avatarVideo')
  private readonly avatarVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('avatarAudio')
  private readonly avatarAudio?: ElementRef<HTMLAudioElement>;

  readonly state$$ = this.sessionFacade.state;
  readonly error$$ = this.sessionFacade.error;
  readonly isVoiceConnected$$ = this.sessionFacade.isVoiceConnected;
  readonly avatarStatus$$ = this.sessionFacade.avatarStatus;
  readonly isAvatarConnected$$ = this.sessionFacade.isAvatarConnected;
  readonly isAvatarUnavailable$$ = this.sessionFacade.isAvatarUnavailable;
  readonly activeTask$$ = this.sessionFacade.activeTask;
  readonly assistantText$$ = this.sessionFacade.assistantText;
  readonly experience$$ = this.sessionFacade.experience;
  readonly canStart$$ = this.sessionFacade.canStart;
  readonly canFinish$$ = this.sessionFacade.canFinish;
  readonly runtimeStatus$$ = this.sessionFacade.runtimeStatus;
  readonly isFullStage$$ = this.sessionFacade.isFullStage;
  readonly usesVideoStandby$$ = this.sessionFacade.usesVideoStandby;
  readonly isPremiumExperience$$ = this.sessionFacade.isPremiumExperience;
  readonly standbyVideoFailed$$ = signal(false);
  readonly textInput$$ = signal('');
  readonly avatarOptions: ReadonlyArray<{
    value: SophiaExperience;
    label: string;
  }> = [
    { value: 'essential', label: 'Essential' },
    { value: 'professional', label: 'Professional' },
    { value: 'premium', label: 'Premium' },
  ];

  readonly standbyImage$$ = computed(() => {
    switch (this.experience$$()) {
      case 'professional':
        return 'assets/avatars/ProffesionalBG.png';
      case 'premium':
        return 'assets/avatars/PremiumBG.png';
      default:
        return 'assets/avatars/SophiaAvatarSIMIL.jpg';
    }
  });

  readonly standbyMobileImage$$ = computed(() => {
    switch (this.experience$$()) {
      case 'professional':
        return 'assets/avatars/ProffesionalBGMobile.jpg';
      case 'premium':
        return 'assets/avatars/PremiumBGMobile.jpg';
      default:
        return 'assets/avatars/SophiaAvatarSIMIL.jpg';
    }
  });

  async startSession(): Promise<void> {
    if (!this.canStart$$()) return;
    this.presentation.clear();
    const remoteAudio = this.remoteAudio?.nativeElement;
    const avatarVideo = this.avatarVideo?.nativeElement;
    const avatarAudio = this.avatarAudio?.nativeElement;
    if (!remoteAudio || !avatarVideo || !avatarAudio) {
      this.sessionFacade.showError(
        new Error('Sophia media elements are not available.'),
        'Could not start Sophia.',
      );
      return;
    }
    await this.sessionFacade.connect({
      remoteAudio,
      avatarVideo,
      avatarAudio,
      prepareToolInput: (sessionId, toolCall) =>
        this.prepareToolInput(sessionId, toolCall),
      onToolOutput: (toolName, output) =>
        this.presentation.handleToolOutput(toolName, output),
      onClosed: () => this.clearKioskState(),
    });
  }

  async finishSession(): Promise<void> {
    this.clearKioskState();
    await this.sessionFacade.close();
  }

  submitText(): void {
    const message = this.textInput$$().trim();
    if (!message) return;
    try {
      this.sessionFacade.submitText(message);
      this.textInput$$.set('');
    } catch (error) {
      this.sessionFacade.showError(error, 'Typed conversation is unavailable.');
    }
  }

  setExperience(value: string): void {
    if (this.sessionFacade.selectExperience(value) && value === 'essential') {
      this.standbyVideoFailed$$.set(false);
    }
  }

  ngOnInit(): void {
    this.sessionFacade.initialize();
  }

  ngOnDestroy(): void {
    this.clearKioskState();
    this.sessionFacade.destroy();
  }

  private clearKioskState(): void {
    this.textInput$$.set('');
    this.presentation.clear();
  }

  private prepareToolInput(
    sessionId: string,
    toolCall: SophiaSessionToolCall,
  ): Promise<Record<string, unknown>> {
    return this.presentation.prepareToolInput(sessionId, toolCall);
  }
}
