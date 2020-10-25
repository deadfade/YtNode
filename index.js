const express = require("express");

const app = express();

app.get("/", (req, res)=>{
	res.send("Welcome to the YtNode.<br>There are 3 types of request actions:<br>/api?action=info&video_id=[vidid] - get information about single video.<br>/api?action=get_playback&video_id=[vidid] - get playback of video.<br>/api?action=search&query=[query] - search videos.");
});

async function get_playback(video_id){
	let resp = await (require("node-fetch"))(`https://youtube.com/get_video_info?video_id=${video_id}&el=embedded&ps=default&eurl=&gl=US&hl=en`);
	let data = await resp.text();
	let parsed = {};
	for(let i in data.split("&")){
		let x = data.split("&")[i].split("=");
		parsed[x[0]] = decodeURIComponent(x[1]);
	}
	let player_response = JSON.parse(parsed["player_response"]);
	if(player_response.playabilityStatus.status == "ERROR"){
		return {error: true, code: -6, message: player_response.playabilityStatus.reason};
	}
	let streaming_data_formats = player_response["streamingData"].formats;
	let final = streaming_data_formats.map(element=>{
		return {
			url: element.url,
			mime: element.mimeType.split(";")[0],
			bitrate: element.bitrate,
			width: element.width,
			height: element.height,
			fps: element.fps,
			quality: element.qualityLabel,
			approxDurationMs: element.approxDurationMs,
			audioSampleRate: element.audioSampleRate,
			audioChannels: element.audioChannels
		};
	});
	return final;
}

app.get("/api", async(req,res)=>{
	if(!req.query["action"])return res.json({error: true, code: -1, message: "action query not specified."});
	let action = req.query.action;
	if(action == "info"){
		let v_id = req.query["video_id"];
		if(!v_id)return res.json({error: true, code: -3, message: "video_id query not specified."});
		let resp = await (require("node-fetch"))(`https://youtube.com/oembed?url=https://youtube.com/watch?v=${v_id}&format=json`);
		let data = await resp.text();
		try {
			let json = JSON.parse(data);
			return res.json(json);
		}catch(e){
			if(resp.status == 404){
				res.status(404);
				return res.json({error: true, code: -4, message: "video with given id not found."});
			}
			return res.json({error: true, code: -5, message: `Unknown error. Contact me@deadfade.cf. Server response: ${data}`});
		}
	}
	if(action == "get_playback"){
		let v_id = req.query["video_id"];
		if(!v_id)return res.json({error: true, code: -3, message: "video_id query not specified."});
		return res.json(await get_playback(v_id));
	}
	if(action == "search"){
		let query = req.query["query"];
		if(!query)return res.json({error: true, code: -7, message: "query query not specified."});
		let resp = await (require("node-fetch"))(`https://youtube.com/results?search_query=${encodeURIComponent(query)}`);
		let data = await resp.text();
		try {
			let scraped = data.slice(data.indexOf("// scraper_data_begin"));
			scraped = scraped.slice(0, scraped.indexOf("// scraper_data_end"));
			scraped = scraped.slice(scraped.indexOf("{"));
			scraped = scraped.slice(0, scraped.indexOf(";"));
			let parsed = JSON.parse(scraped);
			let videos = parsed.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents[0].itemSectionRenderer.contents.filter(element=>element.videoRenderer).map(element=>{
				let video = {};
				video.id = element.videoRenderer.videoId;
				video.title = element.videoRenderer.title.runs[0].text;
				return video;
			});
			return res.json(videos);
		}catch(e){
			return res.json({error: true, code: -5, message: `Unknown error. Contact me@deadfade.cf. Server response: ${e}`});
		}
		console.log(require("util").inspect(videos, {depth:1488}));
	}
	return res.json({error: true, code: -2, message: "unknown action."});
});

app.listen(process.env.PORT);