const express = require('express');
const axios = require('axios');
const app = express();
require('dotenv').config();

const PORT = process.env.PORT || 3000;

const regionMap = {
  na1: 'americas',
  br1: 'americas',
  la1: 'americas',
  la2: 'americas',
  euw1: 'europe',
  eun1: 'europe',
  tr1: 'europe',
  ru: 'europe',
  jp1: 'asia',
  kr: 'asia',
};

function isSameSession(game1, game2) {
  const eightHours = 8 * 60 * 60 * 1000;
  return Math.abs(game1 - game2) <= eightHours;
}

app.get('/recentrecord/:region/:username/:tagline', async (req, res) => {
  const { region, username, tagline } = req.params;
  const routingRegion = regionMap[region.toLowerCase()];
  if (!routingRegion) return res.status(400).send('Invalid region.');

  try {
    // Get PUUID
    const summonerResp = await axios.get(
      `https://${routingRegion}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${username}/${tagline}`,
      {
        headers: { 'X-Riot-Token': process.env.RIOT_API_KEY },
      }
    );
    const puuid = summonerResp.data.puuid;

    // Get match list (latest 20)
    const matchIdsResp = await axios.get(
      `https://${routingRegion}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=20`,
      {
        headers: { 'X-Riot-Token': process.env.RIOT_API_KEY },
      }
    );
    const matchIds = matchIdsResp.data;

    let sessionMatches = [];
    let lastGameTime = null;

    for (const matchId of matchIds) {
      const matchResp = await axios.get(
        `https://${routingRegion}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
        {
          headers: { 'X-Riot-Token': process.env.RIOT_API_KEY },
        }
      );
      const match = matchResp.data;
      const gameEnd = match.info.gameEndTimestamp;
      if (!lastGameTime || isSameSession(gameEnd, lastGameTime)) {
        sessionMatches.push(match);
        lastGameTime = gameEnd;
      } else {
        break;
      }
    }

    if (sessionMatches.length === 0) {
      return res.send(`${username} has no recent session data.`);
    }

    let wins = 0;
    let losses = 0;

    const summonerInfo = await axios.get(
      `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
      {
        headers: { 'X-Riot-Token': process.env.RIOT_API_KEY },
      }
    );
    const summonerId = summonerInfo.data.id;

    for (let match of sessionMatches) {
      const participant = match.info.participants.find(p => p.puuid === puuid);
      if (participant.win) wins++;
      else losses++;
    }

    // Most recent match is the first (latest timestamp)
    // Oldest match is the last (earliest timestamp)
    const newestMatch = sessionMatches[0];
    const oldestMatch = sessionMatches[sessionMatches.length - 1];

    // Fetch current LP (after newest match)
    const endLPResp = await axios.get(
      `https://${region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`,
      {
        headers: { 'X-Riot-Token': process.env.RIOT_API_KEY },
      }
    );
    const lpEnd =
      endLPResp.data.find(e => e.queueType === 'RANKED_SOLO_5x5')?.leaguePoints || 0;

    // Pause briefly to respect rate limits (optional but safe)
    await new Promise(r => setTimeout(r, 1500));

    // Fetch LP again (after the *oldest* match)
    const lpStartResp = await axios.get(
      `https://${region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`,
      {
        headers: { 'X-Riot-Token': process.env.RIOT_API_KEY },
      }
    );
    const lpStart =
      lpStartResp.data.find(e => e.queueType === 'RANKED_SOLO_5x5')?.leaguePoints || 0;

    const lpChange = lpEnd - lpStart;

    res.send(
      `${username}'s recent record: ${wins} wins, ${losses} losses`
    );
  } catch (err) {
    console.error('Error:', err?.response?.data || err.message);
    res
      .status(500)
      .send(err?.response?.data || 'Unexpected error fetching data');
  }
});

app.get('/recentrecord/:region/:username/:tagline/riot.txt', (req, res) => {
  res.sendFile(__dirname + '/riot.txt');
});

app.listen(PORT, () => console.log(`Running on port ${PORT}`));
