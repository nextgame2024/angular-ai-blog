import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { WhatsAppConnectionComponent } from './whatsapp-connection.component';
import {
  WhatsAppConnectionService,
  WhatsAppChannelState,
} from './whatsapp-connection.service';
const state = (): WhatsAppChannelState => ({
  profiles: [{ id: 'pilot_test', label: 'Pilot test', ready: true }],
  channels: [],
  health: { queued: 2, failed: 1, oldestQueuedAt: '2026-11-03T01:00:00Z' },
  mode: 'receive_only',
});
describe('Company WhatsApp receiving controls', () => {
  let fixture: ComponentFixture<WhatsAppConnectionComponent>,
    page: WhatsAppConnectionComponent,
    api: jasmine.SpyObj<WhatsAppConnectionService>;
  beforeEach(async () => {
    api = jasmine.createSpyObj('WhatsAppConnectionService', ['load', 'save']);
    api.load.and.returnValue(of(state()));
    api.save.and.returnValue(of({ revision: 1, enabled: true }));
    await TestBed.configureTestingModule({
      imports: [WhatsAppConnectionComponent],
      providers: [
        provideRouter([]),
        { provide: WhatsAppConnectionService, useValue: api },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(WhatsAppConnectionComponent);
    page = fixture.componentInstance;
  });
  afterEach(() => {
    document.documentElement.classList.remove('dark');
    fixture.destroy();
  });
  it('shows receive-only health without requesting provider credentials', () => {
    fixture.detectChanges();
    expect(api.load).toHaveBeenCalledTimes(1);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Waiting to process: 2');
    expect(text).toContain('Needs attention: 1');
    expect(text).toContain('Receive only');
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
  });
  it('enables with the known revision and refreshes exactly once after success', () => {
    fixture.detectChanges();
    page.toggle('pilot_test');
    expect(api.save).toHaveBeenCalledWith('pilot_test', 0, true);
    expect(api.load).toHaveBeenCalledTimes(2);
    expect(page.notice).toContain('Receiving enabled');
  });
  it('pauses an active connection and protects against double submission', () => {
    api.load.and.returnValue(
      of({
        ...state(),
        channels: [
          {
            channelId: 'c',
            profileId: 'pilot_test',
            enabled: true,
            revision: 4,
            lastReceivedAt: null,
          },
        ],
      }),
    );
    fixture.detectChanges();
    const response = new Subject<{ revision: number; enabled: boolean }>();
    api.save.and.returnValue(response);
    page.toggle('pilot_test');
    page.toggle('pilot_test');
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(api.save).toHaveBeenCalledWith('pilot_test', 4, false);
    response.next({ revision: 5, enabled: false });
    response.complete();
    expect(page.notice).toContain('Receiving paused');
  });
  it('hides settings from unauthorized users and preserves failed-save state', () => {
    api.load.and.returnValue(throwError(() => ({ status: 403 })));
    fixture.detectChanges();
    expect(page.visible).toBe(false);
    expect(fixture.nativeElement.querySelector('section')).toBeNull();
  });
  it('shows actionable server failure through the shared toast without clearing loaded state', () => {
    fixture.detectChanges();
    api.save.and.returnValue(
      throwError(() => ({
        status: 409,
        error: { error: 'Refresh and review before saving.' },
      })),
    );
    page.toggle('pilot_test');
    fixture.detectChanges();
    expect(page.state?.profiles.length).toBe(1);
    expect(page.saving).toBe(false);
    expect(
      fixture.nativeElement.querySelector('app-manager-toast').textContent,
    ).toContain('Refresh and review');
  });
  it('uses loading and retry states, cancels an unfinished request on destruction', () => {
    const response = new Subject<WhatsAppChannelState>();
    api.load.and.returnValue(response);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('app-manager-list-loader'),
    ).not.toBeNull();
    fixture.destroy();
    expect(response.observed).toBe(false);
  });
  it('renders at the current desktop/mobile viewport in both themes without horizontal overflow', () => {
    fixture.detectChanges();
    for (const dark of [false, true]) {
      document.documentElement.classList.toggle('dark', dark);
      fixture.detectChanges();
      const card: HTMLElement = fixture.nativeElement.querySelector('section');
      expect(card.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
      expect(getComputedStyle(card).backgroundColor).toBe(
        dark ? 'rgb(23, 32, 51)' : 'rgb(255, 255, 255)',
      );
      expect(
        getComputedStyle(fixture.nativeElement.querySelector('button'))
          .minHeight,
      ).toBe('44px');
    }
  });
});
