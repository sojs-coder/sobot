const axios = require("axios");
const { JSDOM } = require("jsdom");
const { question } = require("readline-sync")
const DEPTH = parseInt(question("Depth to explore: "));
var nextLinks = [];
var explored = [];
var startingLink  = "https://www.wikipedia.org";

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
    var links = findLinks(l,first);
    explored.push(l);
    console.log("explored: ", l)
    return links
  }catch(err){
    console.log(err)
    return [];
  }
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
    
    if(href && !(rel.includes("noopener") || rel.includes("nofollow"))){
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
start(startingLink, DEPTH).then(console.log)

async function nextUrl(){
  var url = nextLinks.pop();
  var links = await run(url);
  return links
}
