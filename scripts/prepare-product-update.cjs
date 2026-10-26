async(page)=>{
 await page.goto('http://127.0.0.1:4173/');await page.getByText('オフラインでも描いて、聴けます。',{exact:true}).waitFor();await page.reload();
 await page.getByRole('button',{name:'スタジオ',exact:true}).click();await page.getByRole('button',{name:'ハート',exact:true}).click();
 await page.getByRole('textbox',{name:'作品名',exact:true}).fill('更新中も描きかけ');
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('picture-score:project:v1'))?.title==='更新中も描きかけ');
 await page.evaluate(()=>{window.__editorStillOpen=true;});
 const home=await page.context().newPage();await home.goto('http://127.0.0.1:4173/');await home.getByText('オフラインでも描いて、聴けます。',{exact:true}).waitFor();await home.evaluate(()=>{window.__homeUpdate=true;});
 return {ready:true,tabs:page.context().pages().length};
}
