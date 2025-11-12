import * as cds from "@sap/cds";

export const checkCameraAvailability = async (req: cds.Request) => {
    const damagedCameras = await SELECT.from("Installation").columns("ID").where({ status: "Damaged" });
    return req;
};

export const areAllCamerasAvailable = async (req: cds.Request) => {
    const damagedCameras = await SELECT.from("Installation").columns("ID").where({ status: "Damaged" });
    return damagedCameras.length === 0;
}

export const getCamerarecordingIdForLocation = async (req: cds.Request) => {
    const { location } = req.data;

    // First, find the location and check its camera's status
    const locationData = await SELECT.one.from("SubnauticLocation")
        .where({ ID: location })
        .columns((loc: any) => {
            loc.closestCamera((cam: any) => {
                cam.status
            })
        });

    if (locationData?.closestCamera?.status === "Damaged") {
        req.error(400, "The camera for this location is damaged and cannot display a recording.");
        return;
    }

    // If camera is online, proceed to get the recording ID
    const recording = await SELECT.from("CameraImages")
        .columns("ID")
        .where({ subnauticLocation_ID: location });

    if (recording.length === 1) {
        return recording[0].ID;
    } else {
        req.error(404, `No camera recording found for location ID: ${location}`);
    }
}