# VANTA FORM Shopify Theme

Premium Shopify Online Store 2.0 theme for VANTA FORM.

## Architecture
- Liquid + JSON templates
- Section groups for header/footer
- Modular homepage sections
- High-conversion product template
- Product/Organization/WebSite structured data
- Canonicals and social metadata
- Shopify-native /agents.md discovery template
- EN/FR locale foundation
- Performance-first CSS/JS

## Local development

```bash
shopify theme dev --store YOUR-STORE.myshopify.com
```

Shopify CLI will provide a localhost development URL and a theme-editor preview URL.

## Product metafields expected
Namespace: `custom`
- `collection_label`
- `short_description`
- `fit_note`

## Search / AI discoverability
- server-rendered primary content
- canonical URLs
- JSON-LD
- semantic heading/page structure
- `agents.md`
- Shopify-managed `/llms.txt` fallback
- crawlable product/collection content
- editorial architecture for source-backed citations

## Status
Foundation build — 0.1.0.
