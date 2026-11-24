<script lang="ts">
  /**
   * Responsive image delivery for every generated CaveBettor visual.
   *
   * Renders a <picture> element with WebP sources at 640w, 1024w and the full
   * 1536w master, plus explicit dimensions so the layout never shifts while
   * the asset loads.
   */
  let {
    src,
    alt,
    width = 1248,
    height = 832,
    sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 50vw',
    eager = false,
    class: className = ''
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    sizes?: string;
    eager?: boolean;
    class?: string;
  } = $props();

  const name = $derived(src.split('/').pop()!.replace(/\.webp$/, ''));
  const responsive = (w: number) => `/images/responsive/${name}-${w}.webp`;
  const srcset = $derived(
    [640, 1024]
      .map((w) => `${responsive(w)} ${w}w`)
      .concat(`${src} ${width}w`)
      .join(', ')
  );
</script>

<picture class={className}>
  <source type="image/webp" {srcset} {sizes} />
  <img
    {src}
    {alt}
    {width}
    {height}
    loading={eager ? 'eager' : 'lazy'}
    decoding="async"
    fetchpriority={eager ? 'high' : 'auto'}
    class="h-auto max-w-full"
  />
</picture>

<style>
  img {
    max-width: 100%;
    height: auto;
  }
</style>
