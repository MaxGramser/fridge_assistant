/* Fridge Assistant panel — all styles, injected into the shadow root. */

export const STYLES = `
/* Design tokens — 2026 pass: glass surfaces, soft depth, one shared gutter
   so the header, chips, sections and cards all sit on exactly the same axis. */
:host{
  --fa-accent:#007AFF; --fa-red:#FF3B30; --fa-orange:#FF9500; --fa-green:#34C759;
  --fa-grad:linear-gradient(135deg,#0A84FF,#5856D6);
  --fa-ai-grad:linear-gradient(135deg,#7B61FF,#B06AFF);
  --fa-bg:var(--primary-background-color,#f2f4f9);
  --fa-card:var(--card-background-color,#fff);
  --fa-text:var(--primary-text-color,#171a21);
  --fa-muted:var(--secondary-text-color,#7a8089);
  --fa-border:var(--divider-color,rgba(0,0,0,.08));
  --fa-line:color-mix(in srgb,var(--fa-text) 7%,transparent);
  --fa-soft:color-mix(in srgb,var(--fa-text) 5%,transparent);
  --fa-accent-soft:color-mix(in srgb,var(--fa-accent) 11%,transparent);
  --fa-shadow-s:0 1px 2px rgba(15,23,42,.05),0 4px 14px rgba(15,23,42,.05);
  --fa-shadow-m:0 2px 6px rgba(15,23,42,.06),0 14px 34px rgba(15,23,42,.10);
  --fa-shadow-l:0 24px 70px rgba(8,12,35,.35);
  --fa-ease:cubic-bezier(.2,.8,.2,1);
  --fa-gl:max(16px,env(safe-area-inset-left));
  --fa-gr:max(16px,env(safe-area-inset-right));
  display:block; height:100%; background:var(--fa-bg); color:var(--fa-text);
  font-family:"Nunito",-apple-system,BlinkMacSystemFont,"SF Pro Rounded","Segoe UI",Roboto,system-ui,sans-serif;
  overflow-x:hidden;-webkit-tap-highlight-color:transparent;
}
*{box-sizing:border-box;}
.wrap{max-width:960px;margin:0 auto;padding:0 var(--fa-gr) calc(108px + env(safe-area-inset-bottom)) var(--fa-gl);overflow-x:hidden;}

/* ------------------------------------------------------------ top chrome */
/* Full-bleed glass bar; its inner padding equals the page gutter, so the
   brand, search and every icon line up exactly with the cards below. */
.topbar{position:sticky;top:0;z-index:5;
  margin:0 calc(-1 * var(--fa-gr)) 0 calc(-1 * var(--fa-gl));
  padding:env(safe-area-inset-top) var(--fa-gr) 12px var(--fa-gl);
  background:color-mix(in srgb,var(--fa-bg) 78%,transparent);
  -webkit-backdrop-filter:blur(22px) saturate(1.6);
  backdrop-filter:blur(22px) saturate(1.6);
  border-bottom:1px solid var(--fa-line);}
/* First row exactly as tall as HA's own header, so the hamburger/brand sit
   on the same centerline as HA's sidebar header next to it. */
.topbar-row{display:flex;align-items:center;gap:4px;min-height:var(--header-height,56px);}
.brand{display:flex;align-items:center;gap:10px;min-width:0;}
.brand-emoji{--mdc-icon-size:20px;width:36px;height:36px;border-radius:12px;flex:none;
  background:var(--fa-grad);color:#fff;display:inline-flex;align-items:center;justify-content:center;
  box-shadow:0 6px 16px rgba(10,132,255,.35);}
.brand h1{font-size:22px;font-weight:800;margin:0;letter-spacing:-.01em;white-space:nowrap;}
.spacer{flex:1;}
.menu-slot{display:flex;align-items:center;}
.menu-slot ha-menu-button{--mdc-icon-button-size:44px;color:var(--fa-text);margin-right:2px;}
ha-icon{--mdc-icon-size:18px;vertical-align:-4px;}
.btn ha-icon{--mdc-icon-size:17px;}
.hi-act ha-icon,.hi-undo ha-icon{--mdc-icon-size:14px;vertical-align:-3px;}
.df-ico ha-icon{--mdc-icon-size:16px;vertical-align:-3px;}

.counts{display:flex;gap:8px;margin:10px 0 0;flex-wrap:wrap;}
.pill{display:inline-flex;align-items:center;gap:7px;background:var(--fa-card);
  border:1px solid var(--fa-line);border-radius:999px;padding:5px 13px;font-size:13px;
  font-weight:700;color:var(--fa-muted);box-shadow:var(--fa-shadow-s);}
.pill::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--fa-muted);opacity:.45;}
.pill b{color:var(--fa-text);font-weight:800;}
.pill.warn{color:var(--fa-orange);} .pill.warn b{color:var(--fa-orange);} .pill.warn::before{background:var(--fa-orange);opacity:1;}
.pill.bad{color:var(--fa-red);} .pill.bad b{color:var(--fa-red);} .pill.bad::before{background:var(--fa-red);opacity:1;}
.top-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}

.searchrow{display:flex;gap:8px;align-items:center;margin-top:10px;}
.search{display:flex;align-items:center;gap:8px;background:var(--fa-card);
  border:1.5px solid transparent;border-radius:999px;padding:0 16px;height:44px;flex:1;
  min-width:140px;box-shadow:var(--fa-shadow-s);transition:border-color .15s,box-shadow .15s;}
.search:focus-within{border-color:var(--fa-accent);box-shadow:0 0 0 4px var(--fa-accent-soft);}
.search input{border:none;background:none;outline:none;color:var(--fa-text);font-size:16px;width:100%;font-family:inherit;}
.search input::placeholder{color:var(--fa-muted);}
.search.big{height:48px;margin:6px 0 12px;}

/* Chips scroll edge-to-edge but rest exactly on the page gutter. */
.filters{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;
  margin:0 calc(-1 * var(--fa-gr)) 0 calc(-1 * var(--fa-gl));
  padding:12px var(--fa-gr) 14px var(--fa-gl);}
.filters::-webkit-scrollbar{display:none;}
.chip{white-space:nowrap;border:1px solid var(--fa-line);background:var(--fa-card);
  color:var(--fa-text);border-radius:999px;padding:8px 14px;font-size:14px;font-weight:700;
  cursor:pointer;box-shadow:var(--fa-shadow-s);
  transition:transform .15s var(--fa-ease),background .15s,box-shadow .2s;}
.chip:active{transform:scale(.94);}
.chip.active{background:var(--fa-grad);color:#fff;border-color:transparent;
  box-shadow:0 6px 18px rgba(10,132,255,.35);}
.chip-n{display:inline-block;font-size:12px;font-weight:800;color:var(--fa-muted);
  background:var(--fa-soft);border-radius:999px;padding:1px 7px;margin-left:3px;}
.chip.active .chip-n{background:rgba(255,255,255,.24);color:#fff;}
.chip-sep{width:1px;flex:none;background:var(--fa-line);margin:6px 3px;}

/* --------------------------------------------------------------- buttons */
.btn{border:none;border-radius:14px;padding:0 16px;height:44px;font-size:15px;font-weight:800;
  font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;
  gap:7px;transition:transform .15s var(--fa-ease),box-shadow .2s,filter .2s;}
.btn:active{transform:scale(.96);}
.btn.small{height:40px;padding:0 13px;font-size:14px;}
.btn.primary{background:var(--fa-grad);color:#fff;box-shadow:0 6px 18px rgba(10,132,255,.3);}
.btn.primary:hover{filter:brightness(1.06);}
.btn.ghost{background:var(--fa-card);color:var(--fa-text);border:1px solid var(--fa-line);box-shadow:var(--fa-shadow-s);}
.btn.good{background:var(--fa-green);color:#fff;box-shadow:0 6px 18px rgba(52,199,89,.3);}
.btn.danger{background:var(--fa-red);color:#fff;width:100%;box-shadow:0 6px 18px rgba(255,59,48,.25);}
.btn.tossed{background:var(--fa-red);color:#fff;}
.btn.ai{background:var(--fa-ai-grad);color:#fff;box-shadow:0 6px 18px rgba(123,97,255,.35);}
.btn:disabled{opacity:.5;cursor:default;transform:none;box-shadow:none;}
.btn.icon-only{width:44px;padding:0;font-size:18px;flex:none;}
.btn.danger-text{color:var(--fa-red);}
.icon-btn{border:none;background:transparent;color:var(--fa-muted);font-size:19px;cursor:pointer;
  width:44px;height:44px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;
  transition:background .15s,transform .15s var(--fa-ease);}
.icon-btn ha-icon{--mdc-icon-size:21px;vertical-align:0;}
.icon-btn:hover{background:var(--fa-soft);color:var(--fa-text);}
.icon-btn:active{transform:scale(.9);}
.link{background:none;border:none;color:var(--fa-accent);cursor:pointer;font-size:14px;
  padding:8px 2px;font-weight:700;font-family:inherit;}

/* ----------------------------------------------------------------- cards */
.cards{display:flex;flex-direction:column;gap:10px;}
.card{display:flex;align-items:center;gap:12px;background:var(--fa-card);
  border:1px solid var(--fa-line);border-radius:20px;padding:12px;cursor:pointer;
  position:relative;box-shadow:var(--fa-shadow-s);
  transition:transform .18s var(--fa-ease),box-shadow .18s var(--fa-ease);}
.card:hover{transform:translateY(-2px);box-shadow:var(--fa-shadow-m);}
.card:active{transform:scale(.985);}
.card-emoji{font-size:25px;width:48px;height:48px;flex:none;display:flex;align-items:center;
  justify-content:center;background:color-mix(in srgb,var(--fa-accent) 7%,var(--fa-bg));
  border-radius:15px;}
.card-main{flex:1;min-width:0;}
.card-title{font-weight:800;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.card-sub{display:flex;gap:6px;align-items:center;margin-top:3px;flex-wrap:nowrap;overflow:hidden;
  font-size:12px;color:var(--fa-muted);}
.cs-fix,.cs-sep,.card-sub .code{flex:none;}
.cs-more{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.tag{font-size:12px;color:var(--fa-muted);}
.code{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:12px;background:var(--fa-soft);
  border-radius:6px;padding:1px 6px;letter-spacing:.05em;}
.muted{color:var(--fa-muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;}
.card-right{text-align:right;flex:none;display:flex;flex-direction:column;align-items:flex-end;}
.who{display:inline-flex;align-items:center;gap:5px;}
.card-sub .who{font-size:12px;color:var(--fa-muted);}
.avatar{border-radius:50%;object-fit:cover;flex:none;display:inline-flex;align-items:center;
  justify-content:center;vertical-align:middle;background:var(--fa-soft);}
.avatar-i{color:#fff;font-weight:700;line-height:1;}
.d-row b.who{gap:7px;}
.status{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;color:var(--c);
  background:color-mix(in srgb,var(--c) 12%,transparent);border-radius:999px;padding:4px 10px;}
.status::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--c);flex:none;}
.card-when{font-size:11px;color:var(--fa-muted);margin-top:4px;display:flex;align-items:center;
  gap:5px;justify-content:flex-end;min-height:15px;}
.card-print{font-size:15px;flex:none;}
.card.selected{border-color:var(--fa-accent);
  box-shadow:0 0 0 3px var(--fa-accent-soft),var(--fa-shadow-s);}
/* Portion badge on a card: how many of the batch are still open. */
.pbadge{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:11px;font-weight:700;
  background:var(--fa-accent-soft);color:var(--fa-accent);border-radius:6px;
  padding:1px 6px;letter-spacing:.03em;flex:none;}

/* ------------------------------------------------------- urgency sections */
/* Full-width headers inside the cards grid that group items by urgency
   ("Eerst op" / "Deze week" / …) — they make the expiry sort readable even
   in the two-column layout. */
.sec-head{grid-column:1 / -1;display:flex;align-items:center;gap:8px;
  font-size:13px;font-weight:800;color:var(--fa-muted);
  text-transform:uppercase;letter-spacing:.06em;margin:14px 0 2px;}
.sec-head:first-child{margin-top:2px;}
.sec-head .sec-n{font-size:12px;background:var(--fa-soft);border-radius:999px;
  padding:1px 8px;color:var(--fa-muted);}
.sec-head.urgent{color:var(--fa-red);}
.sec-head.urgent .sec-n{background:color-mix(in srgb,var(--fa-red) 12%,transparent);color:var(--fa-red);}

/* ------------------------------------------------------------ empty state */
.loading,.empty{text-align:center;color:var(--fa-muted);padding:64px 20px;}
.empty-emoji{font-size:62px;margin-bottom:14px;animation:fa-float 3.6s ease-in-out infinite;}
@keyframes fa-float{50%{transform:translateY(-8px);}}
.empty h2{color:var(--fa-text);margin:0 0 6px;font-size:21px;font-weight:800;}
.empty.small{padding:34px;}
.empty .btn{margin-top:16px;}

/* ----------------------------------------------------------------- modal */
.overlay{position:fixed;inset:0;background:rgba(8,12,30,.44);
  -webkit-backdrop-filter:blur(8px) saturate(1.2);backdrop-filter:blur(8px) saturate(1.2);
  display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity .18s;z-index:50;padding:0;}
.overlay.show{opacity:1;}
.modal{background:var(--fa-card);width:100%;max-width:520px;overflow-y:auto;
  border-radius:28px 28px 0 0;padding:10px 18px calc(18px + env(safe-area-inset-bottom));
  transform:translateY(28px);transition:transform .22s var(--fa-ease);
  box-shadow:var(--fa-shadow-l);max-height:min(92vh,92dvh);overscroll-behavior:contain;}
.modal::before{content:"";display:block;width:44px;height:5px;border-radius:3px;
  background:var(--fa-soft);margin:2px auto 14px;}
.modal.wide{max-width:600px;}
.overlay.show .modal{transform:none;}
@media(min-width:640px){
  .overlay{align-items:center;padding:24px;}
  .modal{border-radius:26px;padding-top:20px;transform:translateY(12px) scale(.98);}
  .modal::before{display:none;}
}
.modal-head{display:flex;align-items:center;gap:12px;margin-bottom:14px;}
.m-emoji{font-size:32px;width:54px;height:54px;display:flex;align-items:center;justify-content:center;
  background:color-mix(in srgb,var(--fa-accent) 7%,var(--fa-bg));border-radius:16px;flex:none;}
.m-title{flex:1;min-width:0;}
.m-title h2,.m-title h3{margin:0;font-size:19px;font-weight:800;}
.m-name{width:100%;border:none;background:none;outline:none;font-size:19px;font-weight:800;
  color:var(--fa-text);border-bottom:2px solid var(--fa-line);padding:4px 0;font-family:inherit;}
.m-name:focus{border-color:var(--fa-accent);}
.m-strong{font-size:18px;font-weight:800;}
.m-sub{font-size:13px;color:var(--fa-muted);margin-top:2px;}
.m-sub code{font-family:ui-monospace,"SF Mono",Menlo,monospace;background:var(--fa-soft);border-radius:5px;padding:1px 5px;}
.label-preview{display:flex;align-items:center;justify-content:center;min-height:220px;padding:14px;
  background:repeating-conic-gradient(var(--fa-bg) 0% 25%,var(--fa-soft) 0% 50%) 0/22px 22px;border-radius:16px;}
.label-preview img{max-height:420px;width:auto;max-width:100%;border-radius:10px;
  box-shadow:0 4px 22px rgba(0,0,0,.25);background:#fff;}
/* Batch mode: every portion sticker that will be printed, side by side
   (scrolls horizontally when the batch is large). Tapping a sticker toggles
   whether it prints; unticked = dimmed. */
.label-preview.multi{justify-content:flex-start;gap:12px;overflow-x:auto;
  overscroll-behavior-x:contain;}
.label-preview.multi .lp-slot{position:relative;flex:none;min-width:150px;min-height:278px;
  display:flex;align-items:center;justify-content:center;cursor:pointer;
  border-radius:10px;-webkit-tap-highlight-color:transparent;}
.label-preview.multi img{max-height:278px;max-width:none;transition:opacity .15s;}
.lp-slot.off img{opacity:.5;}
.lp-check{position:absolute;top:6px;right:6px;z-index:2;width:26px;height:26px;
  border-radius:50%;background:var(--fa-accent);color:#fff;display:flex;
  align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.3);
  transition:background .15s;}
.lp-check ha-icon{--mdc-icon-size:16px;vertical-align:0;}
.lp-slot.off .lp-check{background:rgba(120,126,140,.55);}
.lp-slot.off .lp-check ha-icon{visibility:hidden;}
.print-note{font-size:12.5px;color:var(--fa-muted);line-height:1.5;margin:12px 4px 0;text-align:center;}
.print-note b{color:var(--fa-text);}
.print-note a{color:var(--fa-text);font-weight:700;text-decoration:underline;text-underline-offset:2px;}
.print-note code{font-size:11.5px;background:var(--fa-soft);padding:1px 5px;border-radius:6px;}

/* ----------------------------------------------------------------- forms */
.field{display:flex;flex-direction:column;gap:5px;margin:10px 0;}
.field>span{font-size:13px;color:var(--fa-muted);font-weight:700;}
.field input{min-width:0;width:100%;box-sizing:border-box;height:46px;border:1.5px solid var(--fa-line);
  border-radius:13px;padding:0 14px;font-size:16px;background:var(--fa-bg);color:var(--fa-text);
  outline:none;transition:border-color .15s,box-shadow .15s;font-family:inherit;}
.field input:focus{border-color:var(--fa-accent);box-shadow:0 0 0 4px var(--fa-accent-soft);}
.datefield{position:relative;min-width:0;}
.datefield input[type=date]{position:absolute;inset:0;width:100%;height:100%;opacity:0;margin:0;
  z-index:1;cursor:pointer;-webkit-appearance:none;appearance:none;}
.df-display{display:flex;align-items:center;gap:8px;height:46px;border:1.5px solid var(--fa-line);
  border-radius:13px;padding:0 14px;font-size:16px;background:var(--fa-bg);color:var(--fa-text);
  white-space:nowrap;overflow:hidden;min-width:0;}
.df-display b{font-weight:800;}
.df-ico{flex:none;}
.df-ph{color:var(--fa-muted);overflow:hidden;text-overflow:ellipsis;}
.datefield input:focus + .df-display{border-color:var(--fa-accent);box-shadow:0 0 0 4px var(--fa-accent-soft);}
.df-clear{position:absolute;right:8px;top:50%;transform:translateY(-50%);z-index:2;display:none;
  width:28px;height:28px;border:none;border-radius:50%;background:var(--fa-soft);color:var(--fa-muted);
  font-size:13px;cursor:pointer;align-items:center;justify-content:center;padding:0;}
.datefield.has-value .df-clear{display:flex;}
.grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;}
.expiry-hint{font-size:13px;font-weight:700;min-height:18px;margin:-2px 2px 4px;}
.select-wrap{position:relative;}
.select-wrap select{width:100%;height:46px;border:1.5px solid var(--fa-line);border-radius:13px;
  background:var(--fa-bg);color:var(--fa-text);font-size:16px;padding:0 32px 0 14px;
  -webkit-appearance:none;appearance:none;font-family:inherit;}
.select-wrap::after{content:"▾";position:absolute;right:14px;top:50%;transform:translateY(-50%);
  color:var(--fa-muted);pointer-events:none;}

.seg{display:flex;gap:5px;background:var(--fa-soft);border-radius:14px;padding:4px;margin:12px 0;}
.seg button{flex:1;border:none;background:none;color:var(--fa-text);padding:10px 4px;border-radius:11px;
  font-size:14px;cursor:pointer;transition:.15s;font-family:inherit;white-space:nowrap;}
.seg button.on{background:var(--fa-card);box-shadow:var(--fa-shadow-s);font-weight:800;}
/* Printer picker in the print modal: queue name + label size per segment. */
.pp-seg{margin:0 0 12px;}
.pp-seg button{display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px;}
.pp-seg ha-icon{--mdc-icon-size:16px;}

/* ----------------------------------------------------------- suggestions */
.suggest{margin:4px 0 6px;padding:12px;border-radius:16px;background:var(--fa-soft);
  display:flex;align-items:center;gap:10px;min-height:10px;}
.suggest:empty{display:none;}
.suggest.ok{background:rgba(52,199,89,.12);}
.suggest.ai{background:rgba(123,97,255,.1);flex-direction:column;align-items:stretch;}
.suggest.bad{background:rgba(255,59,48,.12);}
.s-emoji{font-size:24px;}
.s-take{flex:1;min-width:0;display:flex;align-items:center;gap:10px;background:none;border:none;
  margin:-6px;padding:6px;border-radius:12px;cursor:pointer;text-align:left;font:inherit;color:inherit;}
.s-take:hover{background:rgba(52,199,89,.16);}
.s-take:active{transform:scale(.985);}
.s-body{flex:1;min-width:0;}
.s-sub{font-size:12.5px;color:var(--fa-muted);margin-top:2px;}
.s-badge{font-size:10px;text-transform:uppercase;letter-spacing:.06em;background:var(--fa-green);
  color:#fff;border-radius:6px;padding:2px 6px;font-weight:800;}
.s-badge.ai{background:#7B61FF;}
.s-actions{display:flex;gap:6px;align-items:center;flex:none;flex-wrap:wrap;justify-content:flex-end;}
.s-mini{border:1px solid var(--fa-line);background:var(--fa-card);color:var(--fa-text);border-radius:11px;
  min-width:40px;height:38px;padding:0 10px;font-size:14px;font-weight:800;cursor:pointer;
  display:inline-flex;align-items:center;justify-content:center;gap:4px;font-family:inherit;
  box-shadow:var(--fa-shadow-s);}
.s-mini ha-icon{--mdc-icon-size:16px;vertical-align:0;}
.s-mini.ghost{color:var(--fa-muted);}
.s-mini.ai{background:var(--fa-ai-grad);color:#fff;border:none;}
.ai-head{display:flex;align-items:center;gap:8px;font-size:15px;}
.ai-sub{font-size:12px;color:var(--fa-muted);margin:2px 0 8px;}
.ai-locs{display:flex;gap:8px;margin:10px 0;}
.ai-loc{flex:1;background:var(--fa-card);border-radius:13px;padding:9px 4px;text-align:center;
  box-shadow:var(--fa-shadow-s);}
.ai-loc.active{outline:2px solid var(--fa-accent);outline-offset:-1px;}
.ai-loc span{font-size:18px;display:block;}
.ai-loc b{display:block;font-size:15px;margin:2px 0;}
.ai-loc small{color:var(--fa-muted);font-size:11px;}
.ai-loc-emoji{font-size:18px;display:block;}
.ai-days-wrap{display:inline-flex;align-items:baseline;gap:2px;justify-content:center;margin:4px 0 2px;}
.ai-days{width:46px;text-align:center;font-size:16px;font-weight:800;border:1.5px solid var(--fa-line);
  border-radius:9px;background:var(--fa-card);color:var(--fa-text);height:34px;padding:0 2px;
  -moz-appearance:textfield;font-family:inherit;}
.ai-days::-webkit-outer-spin-button,.ai-days::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.ai-days:focus{outline:none;border-color:var(--fa-accent);}
.ai-days-wrap i{font-style:normal;font-size:11px;color:var(--fa-muted);}
.checkline{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--fa-muted);margin-top:6px;cursor:pointer;}
.spinner{width:20px;height:20px;border:2.5px solid var(--fa-soft);border-top-color:#7B61FF;
  border-radius:50%;animation:spin .7s linear infinite;flex:none;}
@keyframes spin{to{transform:rotate(360deg);}}

.adv.hidden,.hidden{display:none;}
.modal-actions{display:flex;gap:10px;margin-top:18px;}
.modal-actions .btn{flex:1;min-height:48px;}
.modal-actions.three .btn{font-size:14px;padding:0 8px;}
.modal-actions.with-del{flex-wrap:wrap;}

/* ------------------------------------------------------------- templates */
.tp-list{display:flex;flex-direction:column;gap:7px;max-height:60vh;overflow-y:auto;overscroll-behavior:contain;}
.tp-item{display:flex;align-items:center;gap:12px;background:var(--fa-bg);border:1.5px solid transparent;
  border-radius:15px;padding:10px 12px;cursor:pointer;text-align:left;color:var(--fa-text);
  font-family:inherit;transition:border-color .15s,transform .15s var(--fa-ease);}
.tp-item:hover{border-color:var(--fa-accent);}
.tp-item:active{transform:scale(.985);}
.tp-emoji{font-size:24px;width:34px;text-align:center;}
.tp-name{flex:1;display:flex;flex-direction:column;}
.tp-name small{color:var(--fa-muted);font-size:12px;}
.tp-sl{display:flex;gap:5px;}
.tp-sl i{font-style:normal;font-size:11px;color:var(--fa-muted);background:var(--fa-card);
  border-radius:6px;padding:2px 6px;box-shadow:var(--fa-shadow-s);}
.tm-badge{font-size:9px;text-transform:uppercase;letter-spacing:.04em;border-radius:5px;
  padding:1px 5px;font-weight:800;vertical-align:middle;margin-left:6px;}
.tm-badge.own{background:var(--fa-accent);color:#fff;}
.tm-badge.edit{background:var(--fa-orange);color:#fff;}
.te-sec{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--fa-muted);
  font-weight:800;margin:14px 2px 2px;}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
.grid3 .field{margin:4px 0;}
.grid3 .field input{text-align:center;padding:0 6px;}

/* ----------------------------------------------------------- item detail */
.detail-head{display:flex;align-items:center;gap:12px;}
.d-emoji{font-size:38px;width:62px;height:62px;display:flex;align-items:center;justify-content:center;
  background:color-mix(in srgb,var(--fa-accent) 7%,var(--fa-bg));border-radius:18px;}
.d-title{flex:1;} .d-title h2{margin:0;font-size:21px;font-weight:800;}
.d-code{font-family:ui-monospace,monospace;font-size:13px;color:var(--fa-muted);letter-spacing:.08em;margin-top:2px;}
.d-status{margin:14px 0;padding:11px 14px;border-radius:14px;
  background:color-mix(in srgb,var(--c) 13%,transparent);color:var(--c);font-weight:800;text-align:center;}
.d-rows{display:flex;flex-direction:column;}
.d-row{display:flex;justify-content:space-between;gap:12px;padding:11px 2px;
  border-bottom:1px solid var(--fa-line);font-size:15px;}
.d-row:last-child{border:none;}
.d-row span{color:var(--fa-muted);}
.d-row b{text-align:right;font-weight:700;}
.done-row{margin-top:10px;}

/* --------------------------------------------------------------- history */
.hi-row{display:flex;align-items:center;gap:12px;padding:10px 4px;border-bottom:1px solid var(--fa-line);}
.hi-row:last-child{border:none;}
.hi-emoji{font-size:24px;width:34px;text-align:center;flex:none;}
.hi-main{flex:1;min-width:0;}
.hi-title{font-weight:800;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.hi-title .code{font-weight:400;}
.hi-sub2{font-size:12px;color:var(--fa-muted);margin-top:2px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
.hi-act{font-weight:800;}
.hi-act.eaten{color:var(--fa-green);}
.hi-act.tossed{color:var(--fa-red);}
.hi-right{flex:none;text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:3px;}
.hi-right .who{font-size:12px;color:var(--fa-muted);}
.hi-time{font-size:11px;color:var(--fa-muted);}
.hi-btns{display:flex;gap:2px;align-items:center;}
.hi-undo{border:none;background:transparent;color:var(--fa-accent);font-size:12px;font-weight:800;
  cursor:pointer;padding:3px 8px;margin-top:2px;border-radius:8px;font-family:inherit;}
.hi-undo:hover{background:var(--fa-soft);}
.hi-undo:disabled{opacity:.5;}
.hi-del{color:var(--fa-muted);}
.hi-del:hover{color:var(--fa-red);background:color-mix(in srgb,var(--fa-red) 10%,transparent);}
.hi-del.confirm{color:#fff;background:var(--fa-red);}
.hi-del.confirm:hover{background:var(--fa-red);}
.sc-mode{margin:2px 0 10px;}

/* -------------------------------------------------------------- clean-up */
.clean-sec{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--fa-muted);
  margin:14px 2px 6px;font-weight:800;}
.clean-row{display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:1px solid var(--fa-line);}
.clean-row input{width:20px;height:20px;accent-color:var(--fa-red);}
.cr-emoji{font-size:22px;}
.cr-name{flex:1;display:flex;flex-direction:column;}
.cr-name small{color:var(--fa-muted);font-size:12px;}
.cr-days{font-size:12px;font-weight:800;color:var(--c);}

/* ---------------------------------------------------------------- toasts */
#toast-root{position:fixed;bottom:calc(96px + env(safe-area-inset-bottom));left:0;right:0;
  display:flex;flex-direction:column;align-items:center;gap:8px;z-index:100;pointer-events:none;}
.toast{background:color-mix(in srgb,#0d1017 92%,transparent);color:#fff;border-radius:16px;
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
  padding:13px 18px;font-size:14px;font-weight:600;display:flex;align-items:center;gap:14px;
  box-shadow:0 12px 40px rgba(0,0,0,.35);transform:translateY(20px);opacity:0;
  transition:.25s var(--fa-ease);pointer-events:auto;max-width:88%;}
.toast.show{transform:none;opacity:1;}
.toast.bad{background:var(--fa-red);}
.toast.info{background:var(--fa-accent);}
.toast button{background:rgba(255,255,255,.22);border:none;color:#fff;border-radius:9px;
  padding:7px 13px;font-weight:800;cursor:pointer;font-family:inherit;}

/* ------------------------------------------------------------------ FABs */
.fab{position:fixed;z-index:40;right:calc(18px + env(safe-area-inset-right));
  bottom:calc(20px + env(safe-area-inset-bottom));width:62px;height:62px;border-radius:22px;
  border:none;background:var(--fa-grad);color:#fff;line-height:0;display:flex;align-items:center;
  justify-content:center;cursor:pointer;
  box-shadow:0 12px 30px rgba(10,132,255,.45),0 3px 10px rgba(10,132,255,.3);
  transition:transform .15s var(--fa-ease),box-shadow .2s;}
.fab:active{transform:scale(.9);}
.fab ha-icon{--mdc-icon-size:30px;vertical-align:0;}
.fab-scan{width:54px;height:54px;right:calc(94px + env(safe-area-inset-right));
  bottom:calc(24px + env(safe-area-inset-bottom));border-radius:19px;
  background:color-mix(in srgb,var(--fa-card) 86%,transparent);
  -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);
  color:var(--fa-text);border:1px solid var(--fa-line);box-shadow:var(--fa-shadow-m);}
.fab-scan ha-icon{--mdc-icon-size:24px;}

/* --------------------------------------------------------------- scanner */
.scanbox{position:relative;background:#000;border-radius:18px;overflow:hidden;aspect-ratio:4/3;
  max-height:48vh;display:flex;align-items:center;justify-content:center;margin-bottom:2px;}
.scanbox.hidden{display:none;}
.scanbox video{width:100%;height:100%;object-fit:cover;}
.scan-frame{position:absolute;left:8%;right:8%;top:30%;bottom:30%;
  border:3px solid rgba(255,255,255,.95);border-radius:14px;
  box-shadow:0 0 0 999px rgba(0,0,0,.32);}
.scan-torch{position:absolute;top:8px;right:8px;background:rgba(0,0,0,.45);color:#fff;}
.scan-torch:hover{background:rgba(0,0,0,.6);}
.scan-torch.on{background:var(--fa-accent);color:#fff;}
.scan-torch.hidden{display:none;}
.scan-status{min-height:20px;font-size:13px;color:var(--fa-muted);text-align:center;margin:8px 4px 0;}
.scan-manual{display:flex;gap:8px;}
.scan-manual input{flex:1;height:46px;border:1.5px solid var(--fa-line);border-radius:13px;
  padding:0 14px;font-size:16px;background:var(--fa-bg);color:var(--fa-text);text-transform:uppercase;
  letter-spacing:.05em;outline:none;font-family:inherit;}
.filepick{position:relative;overflow:hidden;}
.filepick input{position:absolute;inset:0;opacity:0;font-size:0;}

/* ---------------------------------------------------------------- drawer */
/* Desktop side-peek (Attio-style): fixed on the right, no scrim, the list
   stays interactive. The page content shifts left so nothing is covered. */
.drawer{position:fixed;top:0;right:0;bottom:0;z-index:45;width:min(420px,100vw);
  background:var(--fa-card);border-left:1px solid var(--fa-line);
  box-shadow:-18px 0 60px rgba(8,12,35,.14);display:flex;flex-direction:column;
  padding:18px 18px calc(18px + env(safe-area-inset-bottom));overflow-y:auto;
  overscroll-behavior:contain;transform:translateX(100%);
  transition:transform .24s var(--fa-ease);}
.drawer.show{transform:none;}
.drawer .modal-actions .btn{flex:1;}
.drawer .tp-list{max-height:none;flex:1;}
/* The drawer is a flex column; .search carries flex:1 for the topbar row and
   would stretch vertically into a giant pill here. Same guard for .seg. */
.drawer .search,.drawer .seg{flex:none;}
:host(.fa-drawer-open) .wrap{max-width:none;
  margin-right:calc(420px + 24px);margin-left:24px;
  transition:margin .24s var(--fa-ease);}
:host(.fa-drawer-open) .fab{right:calc(438px + env(safe-area-inset-right));}
:host(.fa-drawer-open) .fab-scan{right:calc(514px + env(safe-area-inset-right));}
:host(.fa-drawer-open) #toast-root{right:444px;left:0;}

/* --------------------------------------------------------------- portions */
.po-sec{margin:4px 0 10px;padding:12px;border-radius:16px;background:var(--fa-soft);}
.po-head{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.po-head>span{font-size:13px;font-weight:800;color:var(--fa-muted);
  text-transform:uppercase;letter-spacing:.05em;}
.pstep{display:inline-flex;align-items:center;gap:6px;}
.pstep .ps-btn{width:34px;height:34px;border-radius:10px;border:1px solid var(--fa-line);
  background:var(--fa-card);color:var(--fa-text);cursor:pointer;display:inline-flex;
  align-items:center;justify-content:center;box-shadow:var(--fa-shadow-s);
  transition:transform .15s var(--fa-ease);}
.pstep .ps-btn:active{transform:scale(.9);}
.pstep .ps-btn:disabled{opacity:.4;cursor:default;}
.pstep .ps-btn ha-icon{--mdc-icon-size:17px;vertical-align:0;}
.pstep .ps-n{min-width:26px;text-align:center;font-size:16px;font-weight:800;}
.ps-note{display:block;font-size:11.5px;color:var(--fa-muted);margin-top:6px;}
.po-rows{display:flex;flex-direction:column;margin-top:8px;}
.po-row{display:flex;align-items:center;gap:10px;padding:8px 2px;
  border-bottom:1px solid var(--fa-line);}
.po-row:last-child{border-bottom:none;}
.po-row .code{flex:none;}
.po-row.done .code{opacity:.55;text-decoration:line-through;}
.po-status{flex:1;min-width:0;font-size:12.5px;color:var(--fa-muted);display:flex;
  align-items:center;gap:6px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}
.po-status ha-icon{--mdc-icon-size:15px;vertical-align:-3px;flex:none;}
.po-row.done.eaten .po-status{color:var(--fa-green);}
.po-row.done.tossed .po-status{color:var(--fa-red);}
.po-row.hl{background:var(--fa-accent-soft);border-radius:10px;padding-left:8px;padding-right:8px;}
.po-act{display:flex;gap:2px;flex:none;}
.po-act .icon-btn{width:36px;height:36px;font-size:15px;}
.po-act .icon-btn ha-icon{--mdc-icon-size:18px;}
.po-undo{border:none;background:transparent;color:var(--fa-accent);font-size:12px;
  font-weight:800;cursor:pointer;padding:4px 8px;border-radius:8px;font-family:inherit;flex:none;}
.po-undo:hover{background:var(--fa-card);}
/* Add-modal portions stepper row */
.pstep-row{display:flex;align-items:center;gap:12px;}
.pstep-row .ps-note{margin-top:0;flex:1;}

/* ------------------------------------------------- touch & motion polish */
@media (hover:none){
  .card:hover,.tp-item:hover,.btn.primary:hover,.icon-btn:hover{transform:none;box-shadow:var(--fa-shadow-s);}
  .icon-btn:hover{background:transparent;box-shadow:none;}
}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{transition:none !important;animation:none !important;}
}

/* --------------------------------------------------------------- desktop */
@media (min-width:640px){
  .brand h1{font-size:25px;}
}
@media (min-width:760px){
  .cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
}
`;
