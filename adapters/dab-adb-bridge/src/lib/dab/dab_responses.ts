import {NetworkInterfaceType} from "../adb/adb_commands";

export interface DabResponse {
    status: number;
    error?: string;
}

export interface VersionResponse extends DabResponse {
    versions: string[];
}

export interface HealthCheckResponse extends DabResponse {
    healthy: boolean;
    message?: string
}

export type RestartResponse = DabResponse


export interface NetworkInterface {
    connected: boolean;
    macAddress: string;
    ipAddress?: string;
    type: NetworkInterfaceType;
}

export interface DeviceInformationResponse extends DabResponse {
    manufacturer: string;
    model: string;
    serialNumber: string;
    chipset: string;
    firmwareVersion: string;
    firmwareBuild: string;
    networkInterfaces: NetworkInterface[];
    screenWidthPixels: number;
    screenHeightPixels: number;
    uptimeSince: number;
}

export interface Application {
    appId: string;
    friendlyName?: string;
    version?: string;
}

export interface ListApplicationsResponse extends DabResponse {
    applications: Application[];
}

export interface ExitApplicationResponse extends DabResponse {
    state: string;
}

export interface GetApplicationStateResponse extends DabResponse {
    state: string;
}

export type LaunchApplicationResponse = DabResponse
export type KeyPressResponse = DabResponse;

export interface StartDeviceTelemetryResponse extends DabResponse {
    frequency: number;
}

export type StopDeviceTelemetryResponse = DabResponse;

export interface StartApplicationTelemetryResponse extends DabResponse {
    frequency: number;
}

export type StopApplicationTelemetryResponse = DabResponse;
