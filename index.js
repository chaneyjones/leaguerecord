app.get('/recentrecord/:region/:gameName/:tagLine', async (req, res) => {
  const { region, gameName, tagLine } = req.params;

  try {
    const accountRes = await axios.get(
      `https://${regionToRegionGroup(region)}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );
    const puuid = accountRes.data.puuid;
    const matchIdsRes = await axios.get(
      `https://${regionToRegionGroup(region)}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=10`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );
    const matchIds = matchIdsRes.data;

    let wins = 0, losses = 0;

    const matchDetails = await Promise.all(
      matchIds.map(matchId => 
        axios.get(
          `https://${regionToRegionGroup(region)}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
          { headers: { 'X-Riot-Token': RIOT_API_KEY } }
        )
      )
    );

    matchDetails.forEach(match => {
      const participant = match.data.info.participants.find(p => p.puuid === puuid);
      if (participant?.win) wins++;
      else losses++;
    });

    res.send(`${gameName}#${tagLine}'s recent record: ${wins} wins, ${losses} losses`);
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(500).send('Error fetching recent games');
  }
});
