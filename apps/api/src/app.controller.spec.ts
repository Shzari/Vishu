import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(() => {
    appController = new AppController();
  });

  it('returns a health payload', () => {
    const result = appController.getHealth();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('multi-vendor-marketplace-api');
    expect(typeof result.timestamp).toBe('string');
  });
});
