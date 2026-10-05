document.documentElement.classList.remove('no-js');

const emitVF = (name, detail = {}) => {
  window.dispatchEvent(new CustomEvent(`vf:${name}`, { detail }));
  if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event: `vf_${name}`, ...detail });
};

document.querySelectorAll('[data-product-root]').forEach((root) => {
  const variantsNode = root.querySelector('[data-product-variants]');
  const form = root.querySelector('[data-product-form]');
  if (!variantsNode || !form) return;

  let variants = [];
  try { variants = JSON.parse(variantsNode.textContent); } catch (_) { return; }

  const variantSelect = form.querySelector('[data-variant-id]');
  const price = root.querySelector('[data-price]');
  const comparePrice = root.querySelector('[data-compare-price]');
  const addButton = form.querySelector('[data-add-to-cart]');
  const addLabel = form.querySelector('[data-add-label]');
  const addPrice = form.querySelector('[data-add-price]');

  const selectedOptions = () => [...form.querySelectorAll('.option-group')].map((group) => {
    const checked = group.querySelector('input[type="radio"]:checked');
    const value = checked?.value || '';
    const display = group.querySelector('[data-option-value]');
    if (display) display.textContent = value;
    return value;
  });

  const setVariant = () => {
    const options = selectedOptions();
    const variant = variants.find((item) => item.options.every((value, index) => value === options[index]));
    if (!variant) {
      if (addButton) addButton.disabled = true;
      if (addLabel) addLabel.textContent = 'Unavailable';
      if (addPrice) addPrice.textContent = '';
      return;
    }

    if (variantSelect) variantSelect.value = String(variant.id);
    if (price) price.textContent = variant.priceFormatted;

    if (comparePrice) {
      const onSale = Number(variant.compareAtPrice) > Number(variant.price);
      comparePrice.textContent = onSale ? variant.compareAtPriceFormatted : '';
      comparePrice.classList.toggle('visually-hidden', !onSale);
    }

    if (addButton) addButton.disabled = !variant.available;
    if (addLabel) addLabel.textContent = variant.available ? 'Add to bag' : 'Unavailable';
    if (addPrice) addPrice.textContent = variant.available ? variant.priceButton : '';

    const url = new URL(window.location.href);
    url.searchParams.set('variant', variant.id);
    window.history.replaceState({}, '', url);

    if (variant.featuredMediaId) {
      root.querySelector(`[data-media-id="${variant.featuredMediaId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    emitVF('variant_change', { variant_id: variant.id, available: variant.available });
  };

  form.addEventListener('change', (event) => {
    if (event.target.matches('input[name^="options["]')) setVariant();
  });

  form.addEventListener('submit', () => {
    emitVF('add_to_cart', { variant_id: Number(variantSelect?.value || 0) });
  });
});

document.addEventListener('click', (event) => {
  const tracked = event.target.closest('[data-vf-event]');
  if (tracked) emitVF(tracked.dataset.vfEvent);
});
const vfMenuButton = document.querySelector('.vf-menu-toggle');
const vfMobileNav = document.querySelector('#vf-mobile-nav');
if (vfMenuButton && vfMobileNav) {
  vfMenuButton.addEventListener('click', () => {
    const open = vfMenuButton.getAttribute('aria-expanded') === 'true';
    vfMenuButton.setAttribute('aria-expanded', String(!open));
    vfMobileNav.hidden = open;
    document.documentElement.classList.toggle('vf-menu-open', !open);
    emitVF('mobile_menu', { open: !open });
  });
}

const vfMegaTrigger=document.querySelector('.vf-nav-trigger');
const vfMega=document.querySelector('#vf-mega-shop');
const closeMega=()=>{if(vfMegaTrigger&&vfMega){vfMega.hidden=true;vfMegaTrigger.setAttribute('aria-expanded','false');}};
if(vfMegaTrigger&&vfMega){vfMegaTrigger.addEventListener('click',()=>{const open=vfMegaTrigger.getAttribute('aria-expanded')==='true';vfMega.hidden=open;vfMegaTrigger.setAttribute('aria-expanded',String(!open));emitVF('mega_menu',{open:!open});});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMega();});document.addEventListener('click',e=>{if(!e.target.closest('.vf-nav-shop'))closeMega();});}
document.querySelector('[data-vf-menu-close]')?.addEventListener('click',()=>{if(vfMenuButton&&vfMobileNav){vfMenuButton.setAttribute('aria-expanded','false');vfMobileNav.hidden=true;document.documentElement.classList.remove('vf-menu-open');}});

document.querySelector('[data-mobile-atc]')?.addEventListener('click',()=>document.querySelector('[data-product-form]')?.requestSubmit());
