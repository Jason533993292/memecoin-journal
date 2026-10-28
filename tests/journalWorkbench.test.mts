import test from "node:test";
import assert from "node:assert/strict";
import { cleanJournalDetails, escapeJournalText, withJournalVersion, journalReview, tradeJournalDay } from "../src/lib/journalWorkbench.ts";
import { createDailyJournalEntry, matchesDailyJournalSearch } from "../src/lib/dailyJournal.ts";
import type { Trade } from "../src/lib/types.ts";

test("untrusted journal metadata cannot inject remote images, SVG or invalid ratings", () => {
  const d = cleanJournalDetails({processScore:999, confidenceBefore:"5", pinned:"true", deletedAt:-1,
    images:[{data:"https://example.com/track.png"},{data:"data:image/svg+xml;base64,aaaa"},{data:'data:image/png;base64,aaa" onerror="alert(1)'}],notes:[{at:"invalid",text:"wrong"}],versions:[{at:null,html:"wrong"}]});
  assert.deepEqual(d.images,[]); assert.deepEqual(d.notes,[]); assert.deepEqual(d.versions,[]);
  assert.equal(d.processScore,undefined); assert.equal(d.confidenceBefore,undefined); assert.equal(d.pinned,false); assert.equal(d.deletedAt,undefined);
  assert.equal(escapeJournalText('<img onerror="x">'), "&lt;img onerror=&quot;x&quot;&gt;");
});
test("metadata sizes are bounded, keeping drafts and cloud rows within limits",()=>{
  const d=cleanJournalDetails({notes:Array.from({length:120},()=>({id:"x",at:1,text:"x".repeat(3000)})),versions:Array.from({length:20},()=>({at:1,title:"title",html:"a".repeat(120000)})),images:[{id:"x",data:"data:image/png;base64,"+"A".repeat(250000)}]});
  assert.equal(d.notes?.length,100);assert.equal(d.notes?.[0].text.length,2000);assert.equal(d.versions?.length,8);assert.equal(d.versions?.[0].html.length,100000);assert.equal(d.images?.length,0);
});
test("changed writing records bounded prior versions without nesting attachments",()=>{
  const entry=createDailyJournalEntry("free");
  let next=entry;
  for(let i=0;i<12;i++) next=withJournalVersion({...next,contentHtml:`<p>${i}</p>`,updatedAt:i+1},next);
  assert.equal(next.details?.versions?.length,8);
  assert.equal(next.details?.versions?.[0].html,"<p>10</p>");
  assert.equal(withJournalVersion(next,next).details?.versions?.length,8);
});
test("review excludes trash, filters dates and counts each trade only once per emotion",()=>{
  const entry={...createDailyJournalEntry("free"),entryDate:"2026-10-26",emotions:["Calm"],linkedTradeIds:["t"]};
  const trade={id:"t",result:"Win",pnlSol:2} as Trade;
  const review=journalReview([entry,{...entry,id:"two"},{...entry,id:"trash",details:{deletedAt:1}},{...entry,id:"old",entryDate:"2025-01-01"}],[trade],"2026-10-01","2026-10-31");
  assert.equal(review.selected.length,2);assert.equal(review.linked.length,1);
  assert.deepEqual(review.emotions,[{emotion:"Calm",entries:2,trades:1,wins:1,pnlSol:2}]);
});
test("search includes lessons, sessions, decisions and personal rules",()=>{
  const e={...createDailyJournalEntry("free"),details:{session:"London",takeaway:"Be patient",rule:"No revenge",notes:[{id:"n",at:1,text:"Stepped away"}]}};
  for(const term of ["london","patient","revenge","stepped"])assert.ok(matchesDailyJournalSearch(e,term));
});
test("same-day suggestions use trade dates rather than the import date",()=>{
  const at=new Date(2026,9,26,12).getTime();
  assert.equal(tradeJournalDay({date:new Date(at),createdAt:1} as Trade),"2026-10-26");
  assert.equal(tradeJournalDay({date:{toDate:()=>new Date(at)}} as Trade),"2026-10-26");
  assert.equal(tradeJournalDay({tradedAt:at} as Trade),"2026-10-26");
  assert.equal(tradeJournalDay({date:"bad"} as Trade),"");
});
