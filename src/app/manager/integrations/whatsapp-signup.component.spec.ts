import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { WhatsAppSignupComponent } from './whatsapp-signup.component';
import { WhatsAppSignupService, signupEvent } from './whatsapp-signup.service';

describe('WhatsApp existing-number authorization', () => {
  let fixture: ComponentFixture<WhatsAppSignupComponent>;
  let api: jasmine.SpyObj<WhatsAppSignupService>;
  const settings = { available: true, appId: '1107965912211301', configId: '1141808901544273', graphVersion: 'v26.0', connection: null };
  let callback: (code?: string) => void;
  const metaEvent = () => new MessageEvent('message', { origin: 'https://www.facebook.com', data: { type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING', data: { waba_id: '123456' } } });
  beforeEach(async () => {
    api = jasmine.createSpyObj('WhatsAppSignupService', ['settings','prepare','start','launch','exchange','complete']);
    api.settings.and.returnValue(of(settings));
    api.prepare.and.resolveTo();
    api.start.and.returnValue(of({ signupId: 'attempt', nonce: 'nonce' }));
    api.launch.and.callFake((_settings, cb) => { callback = cb; });
    api.exchange.and.returnValue(of({ state: 'authorized' }));
    api.complete.and.returnValue(of({ state: 'verified', phoneNumber: '+61 400 388 532', activationPending: true }));
    await TestBed.configureTestingModule({ imports: [WhatsAppSignupComponent], providers: [{ provide: WhatsAppSignupService, useValue: api }] }).compileComponents();
    fixture = TestBed.createComponent(WhatsAppSignupComponent);
    fixture.detectChanges();
  });
  afterEach(() => { document.documentElement.classList.remove('dark'); fixture.destroy(); });
  it('rejects lookalike origins, ordinary signup and malformed messages', () => {
    for (const origin of ['https://www.facebook.com.evil.test','http://www.facebook.com','null']) {
      expect(signupEvent(new MessageEvent('message', { origin, data: metaEvent().data }))).toBeNull();
    }
    expect(signupEvent(new MessageEvent('message', { origin: 'https://www.facebook.com', data: '{' }))).toBeNull();
    expect(signupEvent(new MessageEvent('message', { origin: 'https://www.facebook.com', data: { ...metaEvent().data, event: 'FINISH' } }))).toBeNull();
  });
  for (const eventFirst of [true, false]) {
    it(`exchanges the code immediately and verifies once with eventFirst=${eventFirst}`, async () => {
      await fixture.componentInstance.prepare();
      await fixture.whenStable();
      fixture.componentInstance.connect();
      fixture.componentInstance.connect();
      if (eventFirst) window.dispatchEvent(metaEvent());
      callback('code-from-meta');
      expect(api.exchange).toHaveBeenCalledTimes(1);
      if (!eventFirst) { expect(api.complete).not.toHaveBeenCalled(); window.dispatchEvent(metaEvent()); }
      window.dispatchEvent(metaEvent());
      expect(api.launch).toHaveBeenCalledTimes(1);
      expect(api.complete).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance.notice).toContain('activation is pending');
      expect(fixture.componentInstance.attempt).toBeNull();
    });
  }
  it('removes listeners and ignores late callbacks after destruction', async () => {
    fixture.componentInstance.prepare(); await fixture.whenStable();
    fixture.componentInstance.connect(); fixture.destroy();
    window.dispatchEvent(metaEvent()); callback('late-code');
    expect(api.exchange).not.toHaveBeenCalled(); expect(api.complete).not.toHaveBeenCalled();
  });
  it('shows connection controls in both themes without horizontal overflow', () => {
    for (const dark of [false,true]) {
      document.documentElement.classList.toggle('dark',dark);
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      expect(element.textContent).toContain('Connect your business number');
      expect(element.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
      expect(element.querySelector('button')!.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
  });
  it('shows activation progress without starting a second authorization and refreshes ready state',()=>{
    api.settings.and.returnValue(of({...settings,connection:{state:'syncing',phoneNumber:'+61 400 388 532',historyProgress:50}}));
    fixture.componentInstance.checkStatus();fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Keep WhatsApp Business open');
    expect(fixture.nativeElement.textContent).not.toContain('Prepare connection');
    api.settings.and.returnValue(of({...settings,connection:{state:'ready',phoneNumber:'+61 400 388 532'}}));
    const emit=spyOn(fixture.componentInstance.connectionReady,'emit');
    fixture.componentInstance.checkStatus();fixture.detectChanges();
    expect(emit).toHaveBeenCalledTimes(1);expect(api.start).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('is connected');
  });
  it('explains unavailable onboarding and wraps at narrow and desktop widths in both themes',()=>{
    api.settings.and.returnValue(of({...settings,available:false}));fixture.componentInstance.checkStatus();fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('not available for this company');
    api.settings.and.returnValue(of({...settings,connection:{state:'syncing',phoneNumber:'+61 400 388 532'}}));fixture.componentInstance.checkStatus();
    for(const width of [320,1200])for(const dark of [false,true]){
      document.documentElement.classList.toggle('dark',dark);fixture.nativeElement.style.display='block';fixture.nativeElement.style.width=width+'px';fixture.detectChanges();
      expect(fixture.nativeElement.scrollWidth).toBeLessThanOrEqual(width);expect(fixture.nativeElement.querySelector('button').getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
  });

});
