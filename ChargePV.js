//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////// Script to charge PV energy into your Tesla ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////// Created by MeisterQ 17.03.2023 ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////// V 00.01.01 ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////// Preparations to run this script //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////// 1. Go to https://github.com/MeisterQ/tesla_pv_charge /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////// 2. Install and configure a tesla-motors adapter instance /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////// 3. Grab your VIN and enter it as value in the const VIN //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////// 4. Take existing datapoints for pregard (idGridEnergy) and psurplus (idPVEnergy)(Power going into grid and power taken from grid) and enter the path into the variables  /////////////////////////////////////
/////////////// 5. Take existing datapoint for PV battery SOC (idPVSOC) if you have a pv battery /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////// 6. Have a look at the datapoint to enable the PV charge (idChargeAllPV) and set it to true if you want only PV charge all the time ///////////////////////////////////////////////////////////////////////////
/////////////// 7. Configure constant definitions and IDs below //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////// After configuration //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////// 1. On first run of script it may cause an error because some datapoints are missing. But they will be created on first run ///////////////////////////////////////////////////////////////////////////////////
/////////////// 2. Set datapoint Tesla.Charge.ChargeAllPV in your javascript user variables folder to "true" to charge only PV energy ////////////////////////////////////////////////////////////////////////////////////////
/////////////// 3. Set dp PVBatteryIsPresent to true if a battery is present, and false if not ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////// 4. Enter the minimum required SOC of PV battery to start charging your EV ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////// 5. Connect your vehicle to your wallbox / charger and see how it will work with your PV power ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////// 6. Adjust the values of definitions below. Have a look at their comments /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Constant definitions
const PVBatteryIsPresent = true             // PV system battery is present and will always be charged first
const PVBatterySOC = 95                     // Minimum PV battery SOC to start PV autocharge
const PVIncChargingPower = 700              // Minimum power going into grid to increase amps
const GridDecChargingPower = 0              // Maximum power allowed taken from grid to decrease amps
const maxAmps = 16                          // Maximum amps
const minAmps = 0                           // Minimum amps
const chargeIncFactor = 1                   // Amplifier increasing amps. This deepends on the peak power of your pv system 
const chargeDecFactor = 1                   // Amplifier decreasing amps. This deepends on the peak power of your pv system 
const maxAmpManual = 16                     // Max amps for non-auto mode
const pollTime = 5                          // Data refresh time in seconds
const VIN = ''             // Your VIN
const adapterInstance = 0                   // Adapter instance number
const ChargeStopDelayTime = 10;             // Delay to stop charging. Usefull to increase time during a cloudy day


// IDs of necessary datapoints
const idChargeStart = 'tesla-motors.' + adapterInstance + '.' + VIN + '.remote.charge_start'                        // Start charging
const idChargeStop = 'tesla-motors.' + adapterInstance + '.' + VIN + '.remote.charge_stop'                          // Stop charging
const idChargeAmps = 'tesla-motors.' + adapterInstance + '.' + VIN + '.remote.set_charging_amps-charging_amps'      // Set charging current
const idSOC = 'tesla-motors.' + adapterInstance + '.' + VIN + '.charge_state.battery_level'                         // Car SOC
const idChargeLim = 'tesla-motors.' + adapterInstance + '.' + VIN + '.charge_state.charge_limit_soc'                // Limit SOC
const idChargeState = 'tesla-motors.' + adapterInstance + '.' + VIN + '.charge_state.charging_state'                // Charging state
const idChargePortLatch = 'tesla-motors.' + adapterInstance + '.' + VIN + '.charge_state.charge_port_latch'         // Charge cable connected
const idChargePortOpen = 'tesla-motors.' + adapterInstance + '.' + VIN + '.charge_state.charge_port_door_open'      // Charge port door open
const idActualCurrent = 'tesla-motors.' + adapterInstance + '.' + VIN + '.charge_state.charger_actual_current'      // Actual current

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////// Enter your datapoints below!!! ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const idPVEnergy = '0_userdata.0.Energie.Energymeter.Wirkleistung.Einspeisung'                                      // Energy (W) going INTO grid (0 - xx Watt) Positive only
const idGridEnergy = '0_userdata.0.Energie.Energymeter.Wirkleistung.Bezug'                                          // Energy (W) TAKEN from grid (0 - xx Watt) Positive only
const idChargeAllPV = 'javascript.0.Tesla.Charge.ChargeAllPV'                                                       // Mode (true: only use energy going into grid. false: take all energy from grid). Edit adapter instance if needed
const idPVSOC = 'modbus.1.inputRegisters.30845_SOC'                                                                 // SOC of PV battery (0 - 100)
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////// Enter your datapoints on top!!! //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Define variables
var SOC;
var ChargeLim;
var ChargeState;
var ChargePortLatch;
var ChargePortOpen;
var PVEnergy;
var GridEnergy;
var ChargeAmps = 1;
var LastChargeAmps = 0;
var ChargeStop;
var ChargeStart;
var ChargeAllPV;
var PVSOC;
var PVBatteryCheck;
var ChargeIsStarted = false;
var ChargeIsStopped = false;
var ChargePortLatchOK = false;
var ChargePortDoorOpen = false;
var ActualCurrent = 0;
var DebugMessage;
var ActualSetAmps = 0;


var meinTimeout;

// FUNCTION: Poll data
function getData() {
    SOC = getState(idSOC).val;
    ChargeLim = getState(idChargeLim).val;
    ChargeState = getState(idChargeState).val;
    ChargePortLatch = getState(idChargePortLatch).val;
    ChargePortOpen = getState(idChargePortOpen).val;
    PVEnergy = getState(idPVEnergy).val;
    GridEnergy = getState(idGridEnergy).val;
    ChargeAllPV = getState(idChargeAllPV).val;
    PVSOC = 100; // getState(idPVSOC).val;
    ActualCurrent = getState(idActualCurrent).val;
    ActualSetAmps = getState(idChargeAmps).val;
}

// Run FUNCTION once on startup
createStates();
getData();
batteryCheck();
checkLatch();
calcAmps();
sendAmpsToCar();

// FUNCTION: Check charge port latch
function checkLatch() {
    if ((ChargePortLatch == 'Engaged') && (ChargePortOpen)) {
        ChargePortLatchOK = true;
    }
    else {
        ChargePortLatchOK = false;
    }
}

// FUNCTION: Check if pv system battery is present and minSOC reached
function batteryCheck() {
    if (PVBatteryIsPresent) {
        if (PVSOC > PVBatterySOC) {
            PVBatteryCheck = true;
            log("Battery OK")
        }
        if (PVSOC < PVBatterySOC) {
            PVBatteryCheck = false;
            log("Battery not OK")
        }
    }
    if (!PVBatteryIsPresent) {
        PVBatteryCheck = true;
        log("No battery")
    }
}

// FUNCTION: Calculate charging amps according to PV power
function calcAmps() {
    if ((ChargeAllPV) && (PVBatteryCheck)) {
        if (PVEnergy > PVIncChargingPower) {
            ChargeStop = false;
            ChargeStart = true;
            ChargeAmps = ActualSetAmps + chargeIncFactor;
            log("Increase current");
        }
        if (GridEnergy > GridDecChargingPower) {
            ChargeAmps = ActualSetAmps - chargeDecFactor;
            log("Decrease current");
        }
        if (ChargeAmps <= minAmps) {
            ChargeStart = false;
            ChargeStop = true;
            ChargeAmps = minAmps;
            log("Minimum current");
        }
        if (ChargeAmps > maxAmps) {
            ChargeAmps = maxAmps;
            log("Maximum current");
        }
    }
    else if ((ChargeAllPV) && (!PVBatteryCheck)) {
        log("Chargestop")
        ChargeAmps = minAmps;
        ChargeStart = false;
        ChargeStop = true;
    }
    else {
        log("Fastcharge")
        ChargeAmps = maxAmpManual;
        ChargeStop = false;
        ChargeStart = true;
    }
    //log(ChargeAmps.toString());
}

// FUNCTION: Charge helper
function isCharging() {
    if ((ChargeStart) && (!ChargeIsStarted)) {
        setState(idChargeStart, true);
        ChargeIsStopped = false;
        ChargeIsStarted = true;
        clearTimeout(meinTimeout);
        log("Charge start");
    }

    if ((ChargeStop) && (!ChargeIsStopped)) {
        meinTimeout = setTimeout(function () {
            setState(idChargeStop, true);
            ChargeIsStarted = false;
            ChargeIsStopped = true;
        }, (ChargeStopDelayTime * 1000));

        log("Charge stop");
    }
}

// FUNCTION: Create datapoints in your javascript adapter
function createStates() {
    createState("Tesla.Charge.ChargeAllPV");
}

// FUNCTION: Send charging data
function sendAmpsToCar() {
    if (ChargeAmps != LastChargeAmps) {
        setState(idChargeAmps, ChargeAmps);
        log(ChargeAmps.toString());
        LastChargeAmps = ChargeAmps;
    }

}

// Get data 
schedule('*/' + pollTime + ' * * * * *', function () {
    batteryCheck();
    checkLatch();
    sendAmpsToCar();
});

// Control charging
on({ id: idPVEnergy, change: 'any' }, function (dp) {
    isCharging();
    getData();
    calcAmps();
});