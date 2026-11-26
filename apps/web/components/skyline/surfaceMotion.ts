import { gsap } from 'gsap';

export type SceneFocus = { x: number; y: number; zoom: number };

function panelView(panel: HTMLElement | null): SceneFocus {
  const latitude = Number(panel?.dataset.lat);
  const longitude = Number(panel?.dataset.lng);
  // The illustration faces Bogotá's eastern hills. Only a published point in view can orient it.
  if (!(latitude >= 4.45 && latitude <= 4.84 && longitude >= -74.24 && longitude <= -73.98)) {
    return { x: 0, y: 0, zoom: 0 };
  }
  return {
    x: (4.645 - latitude) / .195 * .055,
    y: (longitude + 74.11) / .13 * .025,
    zoom: .05,
  };
}

const surfaces = '.glass-panel-jb,.card,.glass-panel-total,.pageHeading,.sectionHeading,.investment,.assetRail,.tableCard,.portalLinks,.filters';

export function animateSurfaces(main: HTMLElement) {
  const seen = new WeakSet<Element>();
  const animations = new Set<gsap.core.Tween>();
  const frame = document.querySelector<HTMLElement>('.jbSkylineFrame');
  let sharpness: gsap.core.Tween | undefined;
  let active: HTMLElement | null = null;

  function reveal(root: Element) {
    const candidates = [...root.querySelectorAll(surfaces)];
    if (root !== main && root.matches(surfaces)) candidates.unshift(root);
    const nodes = candidates.filter(element => {
      if (seen.has(element) || !element.getClientRects().length) return false;
      seen.add(element);
      return true;
    });
    if (!nodes.length) return;
    const tween = gsap.fromTo(nodes, { opacity: .8 }, {
      opacity: 1,
      duration: .23,
      stagger: { amount: Math.min(.35, (nodes.length - 1) * .026) },
      clearProps: 'opacity',
      onComplete: () => { animations.delete(tween); },
    });
    animations.add(tween);
  }

  function activate(next: HTMLElement | null) {
    if (next === active) return;
    const previousFilter = frame && getComputedStyle(frame).filter;
    active?.removeAttribute('data-heated');
    active = next;
    if (active) active.dataset.heated = '';
    document.body.toggleAttribute('data-city-focused', Boolean(active));
    if (frame && previousFilter) {
      sharpness?.kill();
      sharpness = gsap.fromTo(frame, { filter: previousFilter }, {
        filter: active ? 'blur(0px) saturate(1.07)' : 'blur(.55px) saturate(.97)',
        duration: .3,
        clearProps: 'filter',
      });
    }
    window.dispatchEvent(new CustomEvent<SceneFocus>('jb:scene-focus', { detail: panelView(active) }));
  }

  function target(element: EventTarget | null) {
    return element instanceof Element ? element.closest<HTMLElement>('[data-heat-panel]') : null;
  }
  function pointer(event: PointerEvent) {
    const panel = target(event.target);
    activate(panel);
    if (!panel) return;
    const bounds = panel.getBoundingClientRect();
    panel.style.setProperty('--heat-x', (event.clientX - bounds.left) + 'px');
    panel.style.setProperty('--heat-y', (event.clientY - bounds.top) + 'px');
  }
  const focus = (event: FocusEvent) => activate(target(event.target));
  const blur = (event: FocusEvent) => activate(target(event.relatedTarget));
  const leave = () => activate(null);
  const observer = new MutationObserver(records => {
    if (active && !active.isConnected) activate(null);
    for (const record of records) {
      for (const node of record.addedNodes) if (node instanceof HTMLElement) reveal(node);
    }
  });

  reveal(main);
  observer.observe(main, { subtree: true, childList: true });
  // The motion module can arrive after the first hover or keyboard focus.
  const focused=main.contains(document.activeElement) ? target(document.activeElement) : null;
  activate(focused ?? main.querySelector<HTMLElement>('[data-heat-panel]:hover'));
  main.addEventListener('pointerover', pointer, { passive: true });
  main.addEventListener('pointermove', pointer, { passive: true });
  main.addEventListener('pointerdown', pointer, { passive: true });
  main.addEventListener('pointerleave', leave);
  main.addEventListener('focusin', focus);
  main.addEventListener('focusout', blur);
  return () => {
    observer.disconnect();
    animations.forEach(tween => tween.revert());
    activate(null);
    sharpness?.kill();
    frame?.style.removeProperty('filter');
    main.removeEventListener('pointerover', pointer);
    main.removeEventListener('pointermove', pointer);
    main.removeEventListener('pointerdown', pointer);
    main.removeEventListener('pointerleave', leave);
    main.removeEventListener('focusin', focus);
    main.removeEventListener('focusout', blur);
  };
}
