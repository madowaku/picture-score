async(page)=>{
 const assert=(ok,message)=>{if(!ok)throw Error(message);};const home=page.context().pages().find(p=>p!==page);
 await home.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();});
 await home.getByRole('button',{name:'作品を残して更新',exact:true}).waitFor({timeout:30000});
 assert(await page.getByRole('button',{name:'作品を残して更新',exact:true}).count()===0,'Studio was interrupted by update UI');
 await home.evaluate(()=>{window.__set=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError');};});
 await home.getByRole('button',{name:'作品を残して更新',exact:true}).click();
 await home.getByRole('status').filter({hasText:'描きかけを保存できませんでした'}).waitFor();
 assert(await home.evaluate(()=>window.__homeUpdate===true),'Reloaded despite failed save');
 await home.evaluate(()=>{Storage.prototype.setItem=window.__set;});
 await home.getByRole('button',{name:'作品を残して更新',exact:true}).click();
 await home.waitForFunction(()=>window.__homeUpdate!==true);
 assert(await page.evaluate(()=>window.__editorStillOpen===true),'Other tab was forcibly reloaded');
 assert(await page.getByRole('textbox',{name:'作品名',exact:true}).inputValue()==='更新中も描きかけ','Other draft changed');
 await home.getByRole('button',{name:'スタジオ',exact:true}).click();assert(await home.getByRole('textbox',{name:'作品名',exact:true}).inputValue()==='更新中も描きかけ','Update lost the draft');
 return {passed:true,checks:['home-only prompt','failed-save blocks update','explicit update reloads','other tab stays open','draft survives update']};
}
