import {DabKey} from "../adb/adb_keymap";

export interface StartApplicationTelemetryRequest {
    appId: string;
    frequency: number;
}

export interface StopApplicationTelemetryRequest {
    appId: string;
}


export interface StartDeviceTelemetryRequest {
    frequency: number;
}

export interface AdbBridgeLaunchApplicationRequest {
    appId: string;
    parameters?: string[] | string;
}

export interface ExitApplicationRequest {
    appId: string;
    force?: boolean;
}

export interface GetApplicationStateRequest {
    appId: string;
}

export interface KeyPressRequest {
    keyCode: DabKey;
}

export interface LongKeyPressRequest {
    keyCode: string;
    durationMs: number;
}

export interface SetLanguageRequest {
    language: string;
}
