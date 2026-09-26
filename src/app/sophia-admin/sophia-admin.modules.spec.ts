import { SOPHIA_ADMIN_MODULES } from './sophia-admin.modules';

describe('SOPHIA_ADMIN_MODULES', () => {
  it('declares sixteen unique business- and provider-neutral module records', () => {
    expect(SOPHIA_ADMIN_MODULES.length).toBe(16);
    expect(new Set(SOPHIA_ADMIN_MODULES.map((item) => item.id)).size).toBe(16);
    expect(new Set(SOPHIA_ADMIN_MODULES.map((item) => item.route)).size).toBe(16);
    const catalog = JSON.stringify(SOPHIA_ADMIN_MODULES).toLowerCase();
    expect(catalog).not.toContain('real estate');
    expect(catalog).not.toContain('openai');
    expect(catalog).not.toContain('tavus');
  });

  it('marks only genuinely delivered workspaces as available', () => {
    const available = SOPHIA_ADMIN_MODULES.filter((item) => item.available);
    expect(available.map((item) => item.id)).toEqual([
      'ADM-01', 'ADM-02', 'ADM-03', 'ADM-04', 'ADM-05', 'ADM-06', 'ADM-07', 'ADM-08', 'ADM-09', 'ADM-10', 'ADM-11', 'ADM-12', 'ADM-13', 'ADM-14', 'ADM-15', 'ADM-16',
    ]);
  });
});
