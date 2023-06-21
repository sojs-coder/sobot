const axios = require("axios");
const { JSDOM } = require("jsdom");
const { question } = require("readline-sync")
const { randomUUID } = require("crypto")
const { MeiliSearch } = require('meilisearch')

const client = new MeiliSearch({
  host: 'https://ms-ae1cbb8d1608-4279.sfo.meilisearch.io',
  apiKey: process.env.MASTER_KEY,
});
 const index = client.index('sites');

async function runUI(){
  let response = await index.deleteAllDocuments();
  console.log(response)
  const searchOrExplore = question("Search through DB or explore new URLs [S/E]: ")

  if(searchOrExplore.toLowerCase() == "s"){
    const toSearch = question("Search: ");
    const search = await index.search(toSearch);
    console.log(search);
    runUI();
  }else{
    const DEPTH = parseInt(question("Depth to explore: "));
    var startingLink  = question("Starting link (https://www.wikipedia.org): ") || "https://www.wikipedia.org";
    await start(startingLink, DEPTH).then((data)=>{
      console.log(data);
      runUI()
    });
  }
  
}
var nextLinks = [];
var explored = [];

async function getHTML(site){
  try{
  const params = {
    headers: {
        "User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
    },
  };
  const raw = await axios.get(site,params)
  return raw.data;
  }catch(err){
    return ""
  }
}
async function run(l){
  try{
    var first = await getHTML(l);
    if(first.length > 1){
      var links = findLinks(l,first);
      explored.push(l);
      console.log("explored: ", l);
      var x = await pushToMeili(l,first);
      console.log(x)
      return links;
    }else{
      return [];
    }
  }catch(err){
    console.log(err)
    return [];
  }
}
function getMeta(document,metaName) {
  const metas = document.getElementsByTagName('meta');

  for (let i = 0; i < metas.length; i++) {
    if (metas[i].getAttribute('name') === metaName) {
      return metas[i].getAttribute('content');
    }
  }

  return '';
}
async function pushToMeili(link,html){
  const { document } = (new JSDOM(html)).window;
  var ps = document.querySelectorAll("p");
  var arr = [];

  for(var i = ps.length; i--; arr.unshift(ps[i]));
  var body = arr.reduce((acc,curr) => acc + curr.textContent, "");

  var bigH1 = (document.querySelectorAll("h1")[0]) ? document.querySelectorAll("h1")[0].textContent : document.title;
  

  var keywords= getMeta(document,"keywords");
  var description = getMeta(document,"description");
  var h1s = Array.from(document.querySelectorAll("h1"));
  var h2s = Array.from(document.querySelectorAll("h2"));
  var h3s = Array.from(document.querySelectorAll("h3"));
  var h4s = Array.from(document.querySelectorAll("h4"));
  var h5s = Array.from(document.querySelectorAll("h5"));
  var h6s = Array.from(document.querySelectorAll("h6"));

  var headings = [...h1s,...h2s,...h3s,...h4s,...h5s,...h6s];
  headings.splice(0,1);
  headings = headings.reduce((acc,curr) => acc +"\n" + curr.textContent, "");

  var docToPush = {
    id: randomUUID(),
    url: link,
    description,
    title: document.title,
    keywords,
    bigH1,
    headings,
    body,
    keywords
  }
  var documents = [docToPush]
  let response = await index.addDocuments(documents)
  return response
}
async function start(start,depth) {
  var firstLinks = await run(start);
  nextLinks = nextLinks.concat(firstLinks)
  for(var i = 0; i < depth; i++){
    const links = await nextUrl();
    nextLinks.concat(links)
  }
  var continueTo = parseInt(question(nextLinks.length + " found (unexplored) URLs. How many do you wish to explore?"));
  
  for(var i = 0; i < continueTo; i++){
    await nextUrl();
  }
  return explored
}
function findLinks(baseURL,html){
  var links = [];
  const { document } = (new JSDOM(html)).window;

  var ls = document.querySelectorAll("a");

  ls.forEach(a => {
    var href = a.href;
    var rel = a.rel
    
    if(href){
      if (!href.startsWith("about:blank") && !href.startsWith("javascript:") && !href.startsWith("mailto:") && !href.startsWith("file:") && explored.indexOf(href) == -1) {
        if (href.startsWith("//")) {
          href = "http:" + href;
        } else if (!href.includes("http")) {
          href = baseURL + href;
        }
        links.push(href);
      }
    }
  });
  return links
}


async function nextUrl(){
  var url = nextLinks.pop();
  var links = await run(url);
  return links
}

runUI()