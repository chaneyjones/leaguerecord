const express = require('express');
const axios = require('axios');
const app = express();
require('dotenv').config();

const PORT = process.env.PORT || 3000;

// Helper function to get session games
function isSameSession(game1, game2) {
  const eightHours = 8 * 60 * 60 * 1000;
  return Math.abs(game1 - game2) <= eightHours;
}

app.get('/recentrecord/:region/:username/:tagline', async (req, res) => {
  const { region, username, tagline } = req.params;

  try {
    // 1. Get PUUID
    const summonerResp = await axios.get(`https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${username}/${tagline}`, {
      headers: { 'X-Riot-Token': process.env.RIOT_API_KEY }
    });
    const puuid = summonerResp.data.puuid;

    // 2. Get match list (latest 20 games)
    const matchIdsResp = await axios.get(`https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=20`, {
      headers: { 'X-Riot-Token': process.env.RIOT_API_KEY }
    });
    const matchIds = matchIdsResp.data;

    let sessionMatches = [];
    let lastGameTime = null;

    for (const matchId of matchIds) {
      const matchResp = await axios.get(`https://${region}.api.riotgames.com/lol/match/v5/matches/${matchId}`, {
        headers: { 'X-Riot-Token': process.env.RIOT_API_KEY }
      });

      const match = matchResp.data;
      const gameEnd = match.info.gameEndTimestamp;
      if (!lastGameTime || isSameSession(gameEnd, lastGameTime)) {
        sessionMatches.push(match);
        lastGameTime = gameEnd;
      } else break;
    }

    let wins = 0, losses = 0, lpStart = null, lpEnd = null;

    // Get summoner ID for ranked LP info
    const summonerInfo = await axios.get(`https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, {
      headers: { 'X-Riot-Token': process.env.RIOT_API_KEY }
    });

    const summonerId = summonerInfo.data.id;

    for (let i = 0; i < sessionMatches.length; i++) {
      const match = sessionMatches[i];
      const participant = match.info.participants.find(p => p.puuid === puuid);
      if (participant.win) wins++;
      else losses++;

      if (i === sessionMatches.length - 1) {
        const startLP = await axios.get(`https://${region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`, {
          headers: { 'X-Riot-Token': process.env.RIOT_API_KEY }
        });
        lpStart = startLP.data.find(entry => entry.queueType === 'RANKED_SOLO_5x5')?.leaguePoints || 0;
      }

      if (i === 0) {
        const endLP = await axios.get(`https://${region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`, {
          headers: { 'X-Riot-Token': process.env.RIOT_API_KEY }
        });
        lpEnd = endLP.data.find(entry => entry.queueType === 'RANKED_SOLO_5x5')?.leaguePoints || 0;
      }
    }

    const lpChange = lpEnd - lpStart;
    res.send(`${username}'s recent record: ${wins} wins, ${losses} losses (${lpChange >= 0 ? '+' : ''}${lpChange} LP)`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching data');
  }
});

app.get('/recentrecord/:region/:username/:tagline/riot.txt', (req, res) => {
  res.sendFile(__dirname + '/riot.txt');
});

app.listen(PORT, () => console.log(`Running on port ${PORT}`));
