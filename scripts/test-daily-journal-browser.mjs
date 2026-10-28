// Isolated browser QA: exercise the actual component with disposable local storage.
// No credentials, real journal records, or production database writes are used.
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const dir = 'src/app/qa-journal-isolated';
const url = `${process.env.JOURNAL_QA_BASE_URL || 'http://127.0.0.1:3017'}/qa-journal-isolated`;
const originalTsconfig = await fs.readFile('tsconfig.json', 'utf8');
let server, browser, context, page, ownsFixture = false;
try {
  await fs.mkdir(dir); // Refuse to overwrite an existing route.
  ownsFixture = true;
  const source = await fs.readFile('src/components/DailyJournalView.tsx', 'utf8');
  await fs.writeFile(`${dir}/Journal.tsx`, source.replace('"@/lib/journalBackend"', '"./backend"').replace('"./Toast"', '"@/components/Toast"').replaceAll('"@/lib/journalBackend"','"./backend"').replaceAll('"./JournalWorkbench"','"@/components/JournalWorkbench"'));
  await fs.writeFile(`${dir}/backend.ts`, `import type { DailyJournalEntry } from '@/lib/types';
const read=():DailyJournalEntry[]=>JSON.parse(localStorage.getItem('qa-records')||'[]');
export async function listSupabaseResearch(_id:string){return [{ca:'qa-thesis',name:'QA thesis',thesis:'Wait for confirmation.'}]}
export async function listSupabaseDailyJournalEntries(_id:string){return read()}
export async function saveSupabaseDailyJournalEntry(_id:string,e:DailyJournalEntry,expected?:number|null){if(localStorage.getItem('qa-force-conflict')==='1')throw new Error('JOURNAL_CONFLICT');if(localStorage.getItem('qa-delay-save')==='1')await new Promise(r=>setTimeout(r,900));localStorage.setItem('qa-records',JSON.stringify([e,...read().filter(x=>x.id!==e.id)]))}
export async function deleteSupabaseDailyJournalEntry(_id:string,id:string){localStorage.setItem('qa-records',JSON.stringify(read().filter(x=>x.id!==id)))}
export async function deleteAllSupabaseDailyJournalEntries(_id:string){localStorage.setItem('qa-records','[]')}
`);
  await fs.writeFile(`${dir}/page.tsx`, `"use client";
import Journal from './Journal';
import {ToastProvider} from '@/components/Toast';
import type {Trade} from '@/lib/types';
export default function Page(){return <ToastProvider><Journal userId="qa-disposable" trades={[{id:'qa-trade',name:'QA Coin',symbol:'QA',result:'Win',pnlSol:1.23,pnlUsd:123,tradedAt:Date.now()} as Trade]}/></ToastProvider>}
`);
  if (!process.env.JOURNAL_QA_BASE_URL) server = spawn('npm', ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', '3017'], {stdio:'ignore',detached:true,env:{...process.env,JOURNAL_ISOLATED_QA:'1'}});
  for(let i=0;i<90;i++) { try { if((await fetch(url)).ok) break; } catch {} await new Promise(r=>setTimeout(r,1000)); }
  browser=await chromium.launch({headless:true});
  context=await browser.newContext({viewport:{width:1600,height:1100}});
  page=await context.newPage();
  const errors=[]; page.on('pageerror', e=>errors.push(e.message)); page.on('console', m=>{if(m.type()==='error' && /hydration|hydrated|did not match|cannot update/i.test(m.text()))errors.push(m.text());});
  await page.goto(url);
  await page.waitForFunction(() => !document.body.innerText.includes('Loading reflections'));
  await page.waitForTimeout(500);
  const button=name=>page.getByRole('button',{name,exact:true});
  const editor=page.locator('[contenteditable=true]');
  const title=page.getByPlaceholder('Reflection title');
  const records=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('qa-records')||'[]'));
  const saved=async()=>{await button('Saved').waitFor({timeout:15000});};
  const openEntries=async()=>{if(!await page.locator('aside').count()) await button('Entries').click();};
  const closeEntries=async()=>{if(await page.locator('aside').count()) await page.getByLabel('Close entries panel').click();};
  const openDetails=async()=>{if(!await page.getByRole('heading',{name:'Entry details'}).count()) await button('Entry details').click();};
  const closeDetails=async()=>{if(await page.getByRole('heading',{name:'Entry details'}).count()) await page.getByLabel('Close entry details panel').click();};
  const openWorkbench=async(name)=>{const target=page.getByRole('button',{name:new RegExp(`^${name}`)});if(!await target.isVisible())await page.getByRole('button',{name:/^Journal tools/}).click();await target.click();};
  if (!process.env.JOURNAL_QA_WORKBENCH_ONLY) {
  assert.equal(await page.locator('aside').count(),0);
  assert.equal(await page.getByRole('heading',{name:'Entry details'}).count(),0);
  await button('Free writing').click();
  const blankBox=await editor.boundingBox();
  assert.ok(blankBox);
  await editor.click({position:{x:80,y:7+32*5+4}});
  await page.keyboard.type('Started on line six');
  assert.equal(await editor.locator(':scope > p').count(),6);
  assert.match(await editor.locator(':scope > p').last().innerText(),/Started on line six/);
  const entryDateButton=page.getByRole('button',{name:/^Entry date/});
  await entryDateButton.click();
  const pickerDate=await page.evaluate(()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-15`;});
  await page.getByRole('dialog',{name:'Choose journal entry date'}).getByRole('button',{name:pickerDate}).click();
  assert.match(await entryDateButton.innerText(),/15/);
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => !document.body.innerText.includes('Loading reflections'));
  await button('Free writing').click();
  await page.waitForTimeout(2100); assert.equal((await records()).length,0);
  await title.fill('QA reflection');
  await editor.fill('First line'); await editor.press('End'); await editor.press('Enter'); await page.keyboard.type('Second line');
  await editor.press('Enter'); await editor.press('Enter'); await page.keyboard.type('Fourth line');
  const lineMetrics=await editor.evaluate(node=>({lineHeight:parseFloat(getComputedStyle(node).lineHeight),blocks:[...node.children].map(child=>({tag:child.tagName,top:child.getBoundingClientRect().top,height:child.getBoundingClientRect().height}))}));
  assert.ok(lineMetrics.blocks.every(block=>block.tag==='P'),`Enter produced inconsistent blocks: ${JSON.stringify(lineMetrics.blocks)}`);
  assert.ok(lineMetrics.blocks.every(block=>Math.abs(block.height-lineMetrics.lineHeight)<1),`Text does not fit one ruled line: ${JSON.stringify(lineMetrics)}`);
  await saved();
  await button('Add a reflection prompt').click(); await button('What was I feeling?').click();
  assert.match(await editor.innerHTML(), /What was I feeling\?/); await saved();
  await editor.focus();
  await editor.evaluate((node) => {
    const data = new DataTransfer();
    data.setData('text/plain', '<img src=x onerror="alert(1)"> A pasted thought');
    data.setData('text/html', '<img src=x onerror="alert(1)"><script>alert(1)</script>');
    node.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
  });
  assert.equal(await editor.locator('img,script').count(),0);
  await saved();
  assert.ok(!(await records())[0].contentHtml.includes('<img'));
  console.log('PASS: Optional prompt, text-only paste and HTML injection guard');
  const original=await editor.innerHTML();
  for(let cycle=0;cycle<5;cycle++) {
    await page.reload();
    await openEntries();
    await page.locator('aside button').filter({hasText:'QA reflection'}).click();
    assert.equal(await editor.innerHTML(),original,`Blank lines changed on reopen ${cycle}`);
    await button('Save now').click(); await saved();
  }
  console.log('PASS: Enter, blank lines, autosave, five save/reopen cycles');
  for(const font of ['clean','classic','typewriter','handwritten']) {
    await page.getByLabel('Journal font').selectOption(font);
    assert.equal(await editor.innerHTML(),original);
    assert.equal(await page.evaluate(()=>localStorage.getItem('memecoin_journal_qa-disposable_journal_font')),font);
  }
  for(const [name,tag] of [['Italic','i'],['Underline','u'],['Strikethrough','strike'],['Bullet list','ul'],['Numbered list','ol'],['Quote','blockquote']]) {
    await editor.fill('Formatting example'); await editor.press('ControlOrMeta+a'); await button(name).click();
    await saved();
    const html=(await records())[0].contentHtml;
    assert.ok(html.includes(`<${tag}>`) || (name==='Strikethrough' && html.includes('<s>')),`${name} was lost: ${html}`);
  }
  await page.waitForTimeout(700);
  assert.equal(await page.evaluate(()=>localStorage.getItem('memecoin_journal_qa-disposable_daily_draft')),null);
  console.log('PASS: Four fonts, all formatting controls, saved-draft cleanup');
  await editor.press('ControlOrMeta+a'); await button('Bold').click();
  await saved(); assert.match((await records())[0].contentHtml, /<(b|strong)>/);
  await openDetails();
  await page.waitForTimeout(250);
  const bookBox=await page.locator('.daily-journal-book').boundingBox();
  assert.ok(bookBox && bookBox.width>=800,`The writing page is too narrow on desktop: ${JSON.stringify(bookBox)}`);
  const detailsBox=await page.locator('[data-tour="daily-journal-reflection-tools"]').boundingBox();
  assert.ok(detailsBox && detailsBox.x>1000 && detailsBox.y<4 && detailsBox.height>=1000,`Details drawer was not attached to the right edge: ${JSON.stringify(detailsBox)}`);
  const accessibility=await new AxeBuilder({page}).include('[data-tour="daily-journal-reflection-tools"]').analyze();
  if(accessibility.violations.length) console.log('Default theme accessibility:',JSON.stringify(accessibility.violations.map((violation)=>({id:violation.id,nodes:violation.nodes.map((node)=>({target:node.target,summary:node.failureSummary}))}))));
  assert.deepEqual(accessibility.violations.filter((violation)=>['serious','critical'].includes(violation.impact)).map((violation)=>violation.id),[]);
  await page.evaluate(()=>document.documentElement.setAttribute('data-theme-preview','modern-platform'));
  const darkAccessibility=await new AxeBuilder({page}).include('[data-tour="daily-journal-reflection-tools"]').analyze();
  assert.deepEqual(darkAccessibility.violations.filter((violation)=>['serious','critical'].includes(violation.impact)).map((violation)=>violation.id),[]);
  await page.evaluate(()=>document.documentElement.removeAttribute('data-theme-preview'));
  await page.screenshot({path:'/tmp/daily-journal-details.png'});
  await button('Calm').click();
  await page.getByPlaceholder('Type a tag and press Enter').fill('patience');
  await page.getByPlaceholder('Type a tag and press Enter').press('Enter');
  await page.getByLabel('Link a trade').selectOption('qa-trade'); await saved();
  let entry=(await records())[0];
  assert.deepEqual(entry.emotions,['Calm']);assert.deepEqual(entry.tags,['patience']);assert.deepEqual(entry.linkedTradeIds,['qa-trade']);
  await page.getByRole('button',{name:'Remove QA Coin from this entry'}).click(); await saved();
  assert.deepEqual((await records())[0].linkedTradeIds,[]);
  await closeDetails();
  await openDetails(); await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('heading',{name:'Entry details'}).count(),0);
  console.log('PASS: Bold formatting, emotions, tags, linked trade and unlink');
  await page.getByLabel('More journal actions').click(); await button('Focus mode').click(); assert.equal(await page.locator('aside').count(),0);
  await page.keyboard.press('Escape'); await button('Entries').waitFor(); await openEntries();
  await page.getByPlaceholder('Search reflections').fill('patience');
  assert.equal(await page.locator('aside button').filter({hasText:'QA reflection'}).count(),1);
  await page.getByPlaceholder('Search reflections').fill('nonexistent');
  assert.equal(await page.locator('aside button').filter({hasText:'QA reflection'}).count(),0);
  await page.getByPlaceholder('Search reflections').fill('');
  await button('Toggle journal calendar').click(); await button('Previous month').click(); await button('Next month').click();
  await button('Toggle journal calendar').click();
  await closeEntries();
  console.log('PASS: Focus/Escape, search, calendar month navigation');
  for(const kind of ['Pre-trade','Post-trade','End-of-day']) {
    await button('Guided entry').click(); await button(kind).click();
    assert.equal(await editor.locator('h2').count(),4);
    assert.equal((await records()).length,['Pre-trade','Post-trade','End-of-day'].indexOf(kind)+1);
    await editor.click(); await page.keyboard.type(`QA ${kind} reflection`); await saved();
  }
  assert.equal((await records()).length,4);
  await button('Next').click(); await button('Previous').click();
  await page.getByLabel('More journal actions').click();
  const downloadPromise=page.waitForEvent('download'); await button('Export journal').click();
  const download=await downloadPromise; const exported=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  assert.equal(exported.length,4);
  console.log('PASS: Three guided templates and JSON export');
  await page.context().setOffline(true);
  await title.fill('Recovered offline draft'); await page.waitForTimeout(700);
  assert.match(await page.evaluate(()=>localStorage.getItem('memecoin_journal_qa-disposable_daily_draft')), /Recovered offline draft/);
  await button('Free writing').click(); await title.fill('Second offline draft'); await page.waitForTimeout(700);
  await page.context().setOffline(false); await button('Save now').click(); await saved();
  await page.reload(); await page.getByLabel('More journal actions').click(); await button('Recover unfinished draft').click();
  assert.equal(await title.inputValue(),'Recovered offline draft'); await saved();
  console.log('PASS: Multiple offline drafts survive switching and reconnect save');
  await button('Delete').click(); await button('Cancel').click(); assert.equal((await records()).length,5);
  await page.evaluate(()=>localStorage.setItem('qa-delay-save','1'));
  await title.fill('Save then navigate'); await button('Save now').click();
  await button('Free writing').click(); await title.fill('Current entry survives');
  await page.waitForTimeout(1200);
  assert.equal(await title.inputValue(),'Current entry survives');
  await button('Save now').click(); await saved();
  assert.equal(await title.inputValue(),'Current entry survives');
  await page.evaluate(()=>localStorage.removeItem('qa-delay-save'));
  console.log('PASS: Delayed save cannot replace the entry being edited');
  await button('Delete').click(); await button('Yes, delete').click();
  await page.waitForTimeout(300);assert.equal((await records()).filter(e=>!e.details?.deletedAt).length,5);
  await page.getByLabel('More journal actions').click(); await button('Delete all entries').click();assert.equal(await button('Delete all entries').isEnabled(),false);
  await page.getByLabel('Type DELETE JOURNAL to confirm').fill('DELETE JOURNAL');await button('Delete all entries').click();
  await page.waitForTimeout(300);assert.equal((await records()).length,0);
  await page.evaluate(()=>localStorage.setItem('memecoin_journal_qa-disposable_daily_draft','{"id":"broken","contentHtml":"<p>bad</p>"}'));
  await page.getByLabel('More journal actions').click(); await button('Recover unfinished draft').click();
  assert.equal(await title.count(),0);

  }
  // Exercise the optional workbench without any real account or database writes.
  await button('Free writing').click(); await title.fill('Workbench acceptance'); await editor.fill('My practical reflection'); await saved();
  await button('Quick thought').click();
  await page.getByLabel('Thought',{exact:true}).fill('Paused before entering');
  await page.getByLabel('Stage',{exact:true}).selectOption('Before');
  await page.getByLabel('Related trade',{exact:true}).selectOption('qa-trade');
  await button('Add timestamped note').click();
  await page.getByLabel('Thought',{exact:true}).fill('Followed the plan after exit');
  await page.getByLabel('Stage',{exact:true}).selectOption('After');
  await button('Add timestamped note').click();
  await button('Snapshot QA Coin').click();
  await page.getByLabel('Link a coin thesis',{exact:true}).selectOption('qa-thesis');
  await page.getByLabel('Session',{exact:true}).fill('Morning session');
  await page.getByLabel('What changed?',{exact:true}).fill('Volume slowed');
  await page.getByLabel('What triggered the decision?',{exact:true}).fill('A clear invalidation');
  await page.getByLabel('Recurring mistakes',{exact:true}).fill('Chasing');
  await page.getByLabel('Positive behaviours',{exact:true}).fill('Patience');
  await page.getByLabel('Process quality',{exact:true}).selectOption('4');
  await page.getByLabel('Satisfaction with outcome',{exact:true}).selectOption('3');
  await page.getByLabel('Confidence before',{exact:true}).selectOption('2');
  await page.getByLabel('Confidence after',{exact:true}).selectOption('4');
  await page.getByLabel('Emotion before',{exact:true}).fill('Anxious');
  await page.getByLabel('Emotion after',{exact:true}).fill('Calm');
  await page.getByLabel('Would I make this decision again?',{exact:true}).selectOption('With changes');
  await page.getByLabel('One takeaway',{exact:true}).fill('Wait for confirmation');
  await page.getByLabel('One action for next time',{exact:true}).fill('Check liquidity');
  await page.getByLabel('Personal trading rule to keep',{exact:true}).fill('Protect capital');
  await page.getByLabel('Review this entry on',{exact:true}).fill('2026-01-01');
  await page.getByLabel('Bookmark / pin this entry',{exact:true}).check();
  await button('Close journal tools').click(); await saved();
  let workEntry=(await records())[0];
  assert.equal(workEntry.details.notes.length,2);assert.equal(workEntry.details.snapshots[0].pnlSol,1.23);
  assert.equal(workEntry.details.thesis.name,'QA thesis');assert.equal(workEntry.details.processScore,4);
  assert.equal(workEntry.details.takeaway,'Wait for confirmation');assert.equal(workEntry.details.pinned,true);
  assert.deepEqual(workEntry.linkedTradeIds,['qa-trade']);
  console.log('PASS: Timestamped before/after thoughts, trade snapshots, thesis links, decision ratings, lessons and bookmarks');

  await openWorkbench('Writing tools');
  await page.getByLabel('Text size',{exact:true}).selectOption('18');
  await page.getByLabel('Line spacing',{exact:true}).selectOption('40');
  await page.getByLabel('Paper',{exact:true}).selectOption('cream');
  await page.getByLabel('Daily writing reminder',{exact:true}).fill('09:00');
  await page.getByLabel('Custom prompt',{exact:true}).fill('How did I manage risk?');await button('Save favourite prompt').click();
  await page.getByLabel('Template name',{exact:true}).fill('My session template');await button('Save current writing as template').click();
  await page.getByLabel('Find in this entry',{exact:true}).fill('practical');
  assert.equal(await page.locator('.journal-find-preview mark').count(),1);
  await page.getByLabel('New checklist item',{exact:true}).fill('Review invalidation');await button('Add checklist item').click();
  await page.getByRole('dialog',{name:'Writing tools',exact:true}).getByLabel('Review invalidation',{exact:true}).check();
  const imageBytes=await page.screenshot({clip:{x:0,y:0,width:64,height:64}});
  await page.getByLabel('Add image',{exact:true}).setInputFiles({name:'example.png',mimeType:'image/png',buffer:imageBytes});
  await page.getByLabel('Image caption',{exact:true}).fill('A sample chart');
  for(const theme of ['','terminal','premium-journal','modern-platform','ocean','graphite']) {
    await page.evaluate(theme=>{if(theme)document.documentElement.setAttribute('data-theme-preview',theme);else document.documentElement.removeAttribute('data-theme-preview');},theme);
    const result=await new AxeBuilder({page}).include('.journal-workbench').analyze();
    const bad=result.violations.filter(v=>['serious','critical'].includes(v.impact));
    assert.deepEqual(bad.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)})),[],`Workbench accessibility: ${theme}`);
  }
  await page.evaluate(()=>document.documentElement.removeAttribute('data-theme-preview'));
  await button('Close journal tools').click();await saved();
  assert.equal(await editor.evaluate(n=>getComputedStyle(n).fontSize),'18px');
  assert.equal(await editor.evaluate(n=>getComputedStyle(n).lineHeight),'40px');
  workEntry=(await records())[0];assert.equal(workEntry.details.checks[0].done,true);assert.equal(workEntry.details.images.length,1);
  assert.match(workEntry.details.images[0].data,/^data:image\/jpeg;base64,/);assert.equal(workEntry.details.images[0].caption,'A sample chart');
  await page.screenshot({path:'/tmp/journal-workbench-book.png'});
  console.log('PASS: Appearance, favourite prompt, reusable template, find, checklist, compressed image/caption and six-theme panel accessibility');

  await editor.click();await editor.press('End');await page.keyboard.type(' XYZ');await button('Undo').click();assert.ok(!(await editor.innerText()).endsWith(' XYZ'));
  await button('Redo').click();assert.ok((await editor.innerText()).includes('XYZ'));
  await editor.press('ControlOrMeta+a');await page.getByRole('toolbar',{name:'Journal formatting',exact:true}).getByRole('button',{name:'Bold',exact:true}).click();
  await button('Clear formatting').click();assert.equal(await editor.locator('b,strong').count(),0);
  await editor.press('End');await editor.press('Enter');await editor.press('/');await button('Timestamp').click();assert.ok(await editor.locator('h3').count());await saved();
  console.log('PASS: Native undo/redo, clear formatting and slash insertion');

  await openDetails();await button('Calm').click();await closeDetails();await saved();
  await openWorkbench('Review');
  assert.match(await page.locator('.journal-workbench').innerText(),/Protect capital/);
  assert.match(await page.locator('.journal-workbench table').innerText(),/1\.23 SOL/);
  const printPromise=page.waitForEvent('download');await button('Export date range for printing').click();
  const print=await printPromise;const printed=await fs.readFile(await print.path(),'utf8');assert.match(printed,/Wait for confirmation/);assert.match(printed,/Content-Security-Policy/);
  await button('Create review entry').click();assert.match(await title.inputValue(),/Weekly review/);await saved();
  await openWorkbench('Review');await page.getByLabel('Period',{exact:true}).selectOption('month');await button('Create review entry').click();assert.match(await title.inputValue(),/Monthly review/);await saved();
  console.log('PASS: Weekly/monthly review, due reminders, emotion sample counts and printable export');

  await openEntries();await page.getByPlaceholder('Search reflections').fill('Workbench acceptance');
  await page.locator('aside button').filter({hasText:'Workbench acceptance'}).click();
  await editor.fill('A later revision');await saved();
  await openWorkbench('Recovery & history');assert.ok(await page.locator('.journal-workbench details').count());
  await page.locator('.journal-workbench details').first().locator('summary').click();await button('Restore this version').first().click();await saved();
  assert.notEqual(await editor.innerText(),'A later revision');
  const second=await context.newPage();await second.goto(url);await second.getByRole('button',{name:'Entries',exact:true}).click();await second.locator('aside button').filter({hasText:'Workbench acceptance'}).click();
  await second.getByText('This entry is being edited in another tab.',{exact:false}).waitFor();
  assert.equal(await second.locator('[data-tour="daily-journal-writing"]').getAttribute('contenteditable'),'false');await second.close();
  await button('Delete').click();await button('Yes, delete').click();
  await openWorkbench('Recovery & history');await button('Restore entry').click();await button('Close journal tools').click();
  await openEntries();await page.getByPlaceholder('Search reflections').fill('Workbench acceptance');await page.locator('aside button').filter({hasText:'Workbench acceptance'}).click();
  assert.ok((await records()).find(e=>e.title==='Workbench acceptance'&&!e.details?.deletedAt));
  await page.reload();await openWorkbench('Writing tools');assert.equal(await page.getByLabel('Text size',{exact:true}).inputValue(),'18');assert.ok(await button('Use My session template').count());
  await button('Use My session template').click();assert.equal(await title.inputValue(),'My session template');await saved();
  console.log('PASS: Writing-version restore, two-tab editing lock, trash restore and persistent preferences/template reuse');
  await page.evaluate(()=>localStorage.setItem('qa-force-conflict','1'));
  await editor.fill('A private edit to recover');await button('Save now').click();
  await page.getByText('This entry changed elsewhere.',{exact:false}).waitFor();
  assert.equal(await editor.count(),0); // The locked editor is no longer editable.
  await page.evaluate(()=>localStorage.removeItem('qa-force-conflict'));
  await button('Keep my writing as a copy').click();await saved();
  assert.match(await title.inputValue(),/recovered copy/);assert.match(await editor.innerText(),/private edit/);
  await button('Free writing').click();await button('Quick thought').click();
  await page.getByLabel('Thought',{exact:true}).fill('Quick note without a title or body');await button('Add timestamped note').click();await button('Close journal tools').click();await saved();
  assert.ok((await records()).some(e=>e.details?.notes?.some(n=>n.text==='Quick note without a title or body')));
  await openWorkbench('Writing tools');await page.getByLabel('Paper',{exact:true}).selectOption('dark');await button('Close journal tools').click();
  const paperContrast=await new AxeBuilder({page}).include('.daily-journal-book').analyze();
  assert.deepEqual(paperContrast.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),[]);
  await openWorkbench('Writing tools');await page.getByLabel('Paper',{exact:true}).selectOption('theme');await button('Close journal tools').click();
  console.log('PASS: Cloud-conflict recovery, body-free quick notes and dark-paper contrast');

  assert.deepEqual(errors,[]);
  console.log('PASS: Delete cancellation, single delete, typed delete-all, invalid draft rejected, no browser runtime errors');
} catch (error) {
  if(page) { console.error((await page.locator('body').innerText()).slice(-5000)); await page.screenshot({path:'/tmp/daily-journal-qa-failure.png'}); }
  throw error;
} finally {
  await browser?.close();
  if(server?.pid) {try{process.kill(-server.pid,'SIGTERM')}catch{}}
  if(ownsFixture) await fs.rm(dir,{recursive:true,force:true});
  if(ownsFixture) await fs.writeFile('tsconfig.json', originalTsconfig);
  if(server) { await new Promise(r=>setTimeout(r,500)); await fs.rm('.next-journal-qa',{recursive:true,force:true}); }
}
