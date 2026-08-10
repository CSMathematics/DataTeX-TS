import { describe, expect, it, vi } from 'vitest';
import { STOICHEIA_LANGUAGE_ID, STOICHEIA_LIGHT_THEME_ID, STOICHEIA_THEME_ID, registerStoicheiaLanguage } from './stoicheiaLanguage';

describe('Stoicheia Monaco language', () => {
  it('registers the tokenizer, language configuration and color theme', () => {
    const register = vi.fn();
    const setLanguageConfiguration = vi.fn();
    const setMonarchTokensProvider = vi.fn();
    const defineTheme = vi.fn();
    const monaco = {
      languages: {
        getLanguages: () => [],
        register,
        setLanguageConfiguration,
        setMonarchTokensProvider,
      },
      editor: { defineTheme },
    };

    registerStoicheiaLanguage(monaco as never);

    expect(register).toHaveBeenCalledWith(expect.objectContaining({ id: STOICHEIA_LANGUAGE_ID }));
    expect(setLanguageConfiguration).toHaveBeenCalledWith(STOICHEIA_LANGUAGE_ID, expect.any(Object));
    expect(setMonarchTokensProvider).toHaveBeenCalledWith(STOICHEIA_LANGUAGE_ID, expect.any(Object));
    expect(defineTheme).toHaveBeenCalledWith(STOICHEIA_THEME_ID, expect.objectContaining({ base: 'vs-dark' }));
    expect(defineTheme).toHaveBeenCalledWith(STOICHEIA_LIGHT_THEME_ID, expect.objectContaining({ base: 'vs' }));

    const provider = setMonarchTokensProvider.mock.calls[0][1];
    const rootRules = provider.tokenizer.root as Array<[RegExp, unknown]>;
    expect(rootRules.some(([pattern]) => pattern.test('\\tkzDrawCircle'))).toBe(true);
    expect(rootRules.some(([pattern]) => pattern.test('\\tkzDefPointsBy'))).toBe(true);
    expect(rootRules.some(([pattern]) => pattern.test('\\tkzDefPointWith'))).toBe(true);
    expect(rootRules.some(([pattern]) => pattern.test('\\tkzGetVectxy'))).toBe(true);
    expect(rootRules.some(([pattern]) => pattern.test('\\tkzDefLine'))).toBe(true);
    expect(rootRules.some(([pattern]) => pattern.test('\\tkzDefTriangle'))).toBe(true);
    expect(rootRules.some(([pattern]) => pattern.test('\\tkzDefSpcTriangle'))).toBe(true);
    for (const command of ['\\tkzPermute', '\\tkzDefSquare', '\\tkzDefRectangle', '\\tkzDefParallelogram']) {
      expect(rootRules.some(([pattern]) => pattern.test(command))).toBe(true);
    }
    for (const command of ['\\tkzDefGoldenRectangle', '\\tkzDefRegPolygon']) {
      expect(rootRules.some(([pattern]) => pattern.test(command))).toBe(true);
    }
    expect(rootRules.some(([pattern]) => pattern.test('\\tkzDefCircle'))).toBe(true);
    expect(rootRules.some(([pattern]) => pattern.test('\\tkzDefCircleBy'))).toBe(true);
    expect(rootRules.some(([pattern]) => pattern.test('\\tkzDefProjExcenter'))).toBe(true);
    expect(rootRules.some(([pattern]) => pattern.test('\\tkzInterLC'))).toBe(true);
    expect(rootRules.some(([pattern]) => pattern.test('\\tkzTestInterLC'))).toBe(true);
    expect(rootRules.some(([pattern]) => pattern.test('\\tkzInterCC'))).toBe(true);
    expect(rootRules.some(([pattern]) => pattern.test('\\tkzTestInterCC'))).toBe(true);
    for (const command of ['\\tkzGetAngle', '\\tkzFindAngle', '\\tkzFindSlopeAngle']) {
      expect(rootRules.some(([pattern]) => pattern.test(command))).toBe(true);
    }
    for (const command of ['\\tkzGetPointCoord', '\\tkzSwapPoints', '\\tkzDotProduct', '\\tkzPowerCircle', '\\tkzGetResult', '\\tkzDefRadicalAxis', '\\tkzIsLinear', '\\tkzIsOrtho']) {
      expect(rootRules.some(([pattern]) => pattern.test(command))).toBe(true);
    }
    expect(rootRules.some(([pattern]) => pattern.test('\\tkzDefRandPointOn'))).toBe(true);
    for (const command of ['\\tkzShowTransformation', '\\tkzProtractor']) {
      expect(rootRules.some(([pattern]) => pattern.test(command))).toBe(true);
    }
    for (const command of ['\\tkzSetUpPoint', '\\tkzSetUpLine', '\\tkzSetUpArc', '\\tkzSetUpCompass', '\\tkzSetUpLabel', '\\tkzSetUpColors', '\\tkzSetUpStyle']) {
      expect(rootRules.some(([pattern]) => pattern.test(command))).toBe(true);
    }
    expect(rootRules.some(([pattern]) => pattern.test('\\begin{tikzpicture}'))).toBe(true);
    expect(provider.tokenizer.options).toBeDefined();
  });
});
