import { Ltr, Panel, PanelBody, PanelHeader, Table, Td, Th, Tr } from "@his/ui";
import { contrast } from "@his/ui/theme";
import { fonts, grays, HIS_COMMIT, mapping, palette, pastels, shape, sidebarGradient, findings } from "@/lib/his-today";
import type { Dict } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";

/*
 * The original HIS design system, as data. Swatches are drawn with inline
 * styles because these colours are being documented, not used: none of them
 * is a role in @his/ui.
 */

function Chip({ hex, size = "size-8" }: { hex: string; size?: string }) {
  return (
    <span aria-hidden className={`${size} inline-block shrink-0 rounded-ctl border border-line`} style={{ background: hex }} />
  );
}

function OnWhite({ hex, label }: { hex: string; label: string }) {
  const ratio = contrast(hex, "#ffffff");
  const pass = ratio >= 4.5;
  return (
    <span className={pass ? "text-xs text-ink-3" : "text-xs font-semibold text-ink"}>
      {pass ? "✓" : "✗"} <Ltr>{ratio.toFixed(1)}:1</Ltr> {label}
    </span>
  );
}

export function HisToday({ t, lang }: { t: Dict["ds"]["his"]; lang: Lang }) {
  return (
    <>
      <p className="mb-stack rounded-card border border-line bg-surface-2 px-pad py-pad-y text-sm text-ink-2">
        {t.themeNote}
      </p>

      <div className="grid items-start gap-stack lg:grid-cols-2">
        <Panel>
          <PanelHeader level="h3" title={t.paletteTitle} />
          <PanelBody className="py-1">
            <p className="py-2 text-xs text-ink-3">{t.paletteNote}</p>
            {palette.map((c) => (
              <div key={c.name} className="flex items-center gap-3 border-b border-line-2 py-2 last:border-b-0">
                <Chip hex={c.hex} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <Ltr>
                      <code className="text-sm font-medium">{c.name}</code>
                    </Ltr>
                    <Ltr>
                      <code className="text-xs text-ink-3">{c.hex}</code>
                    </Ltr>
                  </div>
                  <div className="text-xs text-ink-3">{c.note[lang]}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  {c.uses ? (
                    <span className="text-xs text-ink-2">
                      <Ltr>{c.uses}</Ltr> {t.uses}
                    </span>
                  ) : null}
                  <OnWhite hex={c.hex} label={t.onWhite} />
                </div>
              </div>
            ))}
          </PanelBody>
        </Panel>

        <div className="flex flex-col gap-stack">
          <Panel>
            <PanelHeader level="h3" title={t.graysTitle} />
            <PanelBody className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {grays.map((g) => (
                <div key={g.name} className="flex flex-col items-center gap-1">
                  <Chip hex={g.hex} size="h-10 w-full" />
                  <code className="text-2xs">{g.name}</code>
                  <span className="text-2xs text-ink-3">
                    <Ltr>{g.uses ?? "—"}</Ltr>
                  </span>
                </div>
              ))}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader level="h3" title={t.pastelsTitle} />
            <PanelBody className="flex flex-wrap gap-1.5">
              {pastels.map((p) => (
                <span key={p.name} title={`${p.name} ${p.hex}`}>
                  <Chip hex={p.hex} size="size-7" />
                </span>
              ))}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader level="h3" title={t.sidebarTitle} />
            <PanelBody className="flex items-center gap-3">
              <span
                aria-hidden
                className="h-16 w-12 shrink-0 rounded-ctl"
                style={{ background: `linear-gradient(to bottom, ${sidebarGradient[0]}, ${sidebarGradient[1]})` }}
              />
              <div className="text-sm text-ink-2">
                <Ltr>
                  <code>
                    linear-gradient({sidebarGradient[0]} → {sidebarGradient[1]})
                  </code>
                </Ltr>
                <div className="text-xs text-ink-3">
                  <Ltr>256px · #ffffff · rgb(255 255 255 / 0.2) hover + active</Ltr>
                </div>
              </div>
            </PanelBody>
          </Panel>

          <div className="grid gap-stack sm:grid-cols-2">
            <Panel>
              <PanelHeader level="h3" title={t.typeTitle} />
              <PanelBody className="flex flex-col gap-2 py-3">
                {fonts.map((f) => (
                  <div key={f.family}>
                    <div className="flex items-baseline gap-2">
                      <span className="text-md font-medium">{f.family}</span>
                      <span className="text-2xs text-ink-3">{f.used ? t.used : t.unused}</span>
                    </div>
                    <div className="text-xs text-ink-3">{f.role[lang]}</div>
                  </div>
                ))}
              </PanelBody>
            </Panel>
            <Panel>
              <PanelHeader level="h3" title={t.shapeTitle} />
              <PanelBody className="flex flex-col gap-2 py-3">
                {shape.map((s) => (
                  <div key={s.name} className="flex items-baseline justify-between gap-2">
                    <Ltr>
                      <code className="text-xs whitespace-nowrap">{s.name}</code>
                    </Ltr>
                    <span className="text-end text-xs text-ink-3">
                      <Ltr>{s.value}</Ltr> · {s.uses[lang]}
                    </span>
                  </div>
                ))}
              </PanelBody>
            </Panel>
          </div>
        </div>
      </div>

      <Panel className="mt-stack">
        <PanelHeader level="h3" title={t.mapTitle} />
        <Table>
          <thead>
            <tr>
              <Th>{t.cols.his}</Th>
              <Th>{t.cols.role}</Th>
              <Th>{t.cols.what}</Th>
            </tr>
          </thead>
          <tbody>
            {mapping.map((m) => (
              <Tr key={m.his}>
                <Td>
                  <span className="flex items-center gap-2">
                    {m.swatch ? <Chip hex={m.swatch} size="size-4" /> : <span className="size-4 shrink-0" />}
                    <Ltr>
                      <code className="text-sm">{m.his}</code>
                    </Ltr>
                  </span>
                </Td>
                <Td tone="id">
                  <Ltr>
                    <code>{m.role}</code>
                  </Ltr>
                </Td>
                <Td tone="wrap" className="min-w-72 py-2 text-sm text-ink-2">
                  {m.what[lang]}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <Panel className="mt-stack">
        <PanelHeader level="h3" title={t.findingsTitle} />
        <PanelBody>
          <ul className="flex list-disc flex-col gap-1.5 ps-5 text-sm text-ink-2">
            {findings.map((f) => (
              <li key={f.en}>{f[lang]}</li>
            ))}
          </ul>
        </PanelBody>
      </Panel>
    </>
  );
}

export { HIS_COMMIT };
