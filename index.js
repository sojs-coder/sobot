const axios = require("axios");
const { JSDOM } = require("jsdom");
const { question } = require("readline-sync")
const { randomUUID } = require("crypto");
const nunjucks = require("nunjucks");
const http = require('http');
const { Server } = require("socket.io");
const { MeiliSearch } = require('meilisearch');
const express = require("express");



const app = express();


const server = http.createServer(app);

const io = new Server(server);

io.on("connection", async (socket) => {
  var uid = socket.id;
  console.log("wheeeeee");

  // Rest of your code inside the "connection" event listener
  socket.on("startScan", async (data) => {
    const toIndex = data.toIndex;
    const depth = data.depth || 500;
    console.log(toIndex);

    log(`##### STARTING SCAN ${toIndex} with depth of ${depth}`);
    var resData = await start(toIndex, 500, uid)
    log("Stream over, scan complete. \n" + resData, uid)
  });
});
app.use(express.json());
app.use(express.static("public"));
nunjucks.configure("./views", {
    autoescape: true,
    express: app
});
app.get('/',(req,res)=>{
  res.render('index.njk');
})
app.get("/search", async (req,res)=>{
  console.log(req.query.q);
  if(req.query.q){
    const results = await index.search(req.query.q.split("+").join(" "));
    res.render("search.njk",{
      results
    });
  }else{
    res.render("index.njk")
  }
});
app.get("/index",async (req,res)=>{
  const toIndex = req.query.url;
  const depth = req.query.depth || 500
  res.render("gather.njk",{toIndex,depth})
})

server.listen(3000,()=>{
  console.log("BEEP BOOP BOX IS ON http://localhost:3000");
})

const client = new MeiliSearch({
  host: 'https://ms-ae1cbb8d1608-4279.sfo.meilisearch.io',
  apiKey: process.env.MASTER_KEY,
});
 const index = client.index('sites');
//  let response = index.deleteAllDocuments();
//  console.log(response)
async function runUI(){

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


async function getHTML(site,uid){
  try{
  const params = {
    headers: {
        "User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
    },
  };
  const raw = await axios.get(site,params)
  return raw.data;
  }catch(err){
    log(err,uid)
    return ""
  }
}
async function run(l,uid){
  log(`[${l}] started new scan`)
  try{
    var first = await getHTML(l,uid);
    if(first.length > 1){
      var links = findLinks(l,first,uid);
      log("explored: "+l,uid);
      var x = await pushToMeili(l,first,uid);
      log(links.length + " links found")
      return links;
    }else{
      return [];
    }
  }catch(err){
    log(err,uid)
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
async function pushToMeili(link,html,uid){
  log(`--- SCANNING ${link} ---`,uid)
  const { document } = (new JSDOM(html)).window;
  var ps = document.querySelectorAll("p");
  var arr = [];

  for(var i = ps.length; i--; arr.unshift(ps[i]));
  var body = arr.reduce((acc,curr) => acc + curr.textContent, "");

  var bigH1 = (document.querySelectorAll("h1")[0]) ? document.querySelectorAll("h1")[0].textContent : document.title;
  
  log(`BIGH1: ${bigH1}`,uid)
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
  log("Headings found",uid)
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
  log(`Pushed to DB for indexing... ${response}`)
  return response
}
async function start(start,depth=500,uid) {
  log(`[${start}] SCAN started...`)
  var firstLinks = await run(start,uid);
  log(`[${start}] Links for ${start} processed`,uid)
  nextLinks = nextLinks.concat(firstLinks)
  for(var i = 0; i < depth; i++){
    const links = await nextUrl(uid);
    nextLinks.concat(links);

  }
  log(`${nextLinks.length} unexplored links found. Exploring all`)
  
  for(var i = 0; i < nextLinks.length; i++){
    await nextUrl(uid);
  }
}
function removeTrailingSlash(site)     
{     
    return site.replace(/\/$/, "");
} 
function getRawUrl(url) {
  return url.split(/[?#]/)[0];
}
function findLinks(baseURL,html,uid){
  var links = [];
  const { document } = (new JSDOM(html)).window;

  var ls = document.querySelectorAll("a");

  ls.forEach(a => {
    var href = a.href;
    var rel = a.rel 
    
    if(href){
      if (!href.startsWith("about:blank") && !href.startsWith("javascript:") && !href.startsWith("mailto:") && !href.startsWith("file:")) {
        if (href.startsWith("//")) {
          href = "http:" + href;
        } else if (!href.includes("http")) {
          href = getRawUrl(removeTrailingSlash(baseURL) + href);
        }
        links.push(href);
      }
    }
  });
  return links
}


async function nextUrl(uid){
  var url = nextLinks.pop();
  var links = await run(url,uid);
  log(`[${url}] found a total of ${links.length} URLS`)
  return links
}

function log(log,uid){
  io.to(uid).emit("data",{data:"\n"+log});
}