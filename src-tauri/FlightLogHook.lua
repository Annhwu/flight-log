-- FlightLog DCS Hook
-- Creates one JSON file per session in Saved Games/DCS/FlightLog/
-- Start/end are IRL epoch seconds (os.time). Aircraft = list of internal type names flown.

local FlightLog = {}

local sessionFile     = nil
local sessionStart    = nil
local sessionMap      = nil
local sessionAircraft = {}     -- list of unique real type names flown this session
local lastSample      = 0

local function isRealName(s)
    return type(s) == 'string' and s ~= '' and tonumber(s) == nil
end

local function addAircraft(name)
    if not isRealName(name) then return end
    for _, v in ipairs(sessionAircraft) do
        if v == name then return end
    end
    table.insert(sessionAircraft, name)
end

local function jsonStringArray(list)
    local parts = {}
    for _, v in ipairs(list) do
        table.insert(parts, '"' .. v:gsub('\\', '\\\\'):gsub('"', '\\"') .. '"')
    end
    return '[' .. table.concat(parts, ',') .. ']'
end

local function safeGetMap()
    local ok1, v1 = pcall(function()
        local m = DCS.getCurrentMission and DCS.getCurrentMission()
        return m and m.mission and m.mission.theatre
    end)
    if type(v1) == 'string' and v1 ~= '' then return v1 end
    local ok2, v2 = pcall(function()
        return Terrain.GetTerrainConfig('Name')
    end)
    if type(v2) == 'string' and v2 ~= '' then return v2 end
    return nil
end

local function safeGetAircraft()
    -- Best: Export self data returns the internal type name (e.g. "FA-18C_hornet")
    local ok1, v1 = pcall(function()
        if Export and Export.LoGetSelfData then
            local d = Export.LoGetSelfData()
            return d and d.Name
        end
    end)
    if isRealName(v1) then return v1 end

    -- Fallback: player info unit_type (slot id is numeric and ignored by addAircraft)
    local ok2, v2 = pcall(function()
        local id = net.get_my_player_id and net.get_my_player_id()
        if not id then return nil end
        local info = net.get_player_info(id)
        return info and (info.unit_type or info.slot) or nil
    end)
    if type(v2) == 'string' and v2 ~= '' then return v2 end

    return nil
end

local function writeSession(endTime, done)
    if not sessionFile then return end
    local map = (sessionMap or ''):gsub('\\', '\\\\'):gsub('"', '\\"')
    local f = io.open(sessionFile, 'w')
    if f then
        f:write(string.format(
            '{"start":%d,"end":%d,"map":"%s","aircraft":%s,"done":%s}',
            sessionStart or 0,
            endTime or 0,
            map,
            jsonStringArray(sessionAircraft),
            done and 'true' or 'false'
        ))
        f:close()
    end
end

function FlightLog.onMissionLoadEnd()
    sessionStart    = os.time()
    sessionMap      = safeGetMap()
    sessionAircraft = {}
    lastSample      = 0
    addAircraft(safeGetAircraft())
    local dir = lfs.writedir() .. 'FlightLog'
    lfs.mkdir(dir)
    sessionFile     = dir .. '/FlightLogSession_' .. sessionStart .. '.json'
    writeSession(0, false)
end

-- Sample periodically (throttled ~2s) to catch every aircraft the player flies
function FlightLog.onSimulationFrame()
    if not sessionFile then return end
    local now = (DCS.getModelTime and DCS.getModelTime()) or 0
    if now - lastSample < 2 then return end
    lastSample = now
    addAircraft(safeGetAircraft())
end

function FlightLog.onPlayerChangeSlot(playerID)
    pcall(function()
        local myId = net.get_my_player_id and net.get_my_player_id()
        if myId and playerID ~= myId then return end
        addAircraft(safeGetAircraft())
    end)
end

function FlightLog.onSimulationStop()
    if not sessionFile then return end

    addAircraft(safeGetAircraft())
    writeSession(os.time(), true)

    sessionFile     = nil
    sessionStart    = nil
    sessionMap      = nil
    sessionAircraft = {}
end

DCS.setUserCallbacks(FlightLog)
