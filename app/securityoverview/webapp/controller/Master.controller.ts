import Controller from "sap/ui/core/mvc/Controller";
import ui5Event from "sap/ui/base/Event";
import Component from "../Component";
import JSONModel from "sap/ui/model/json/JSONModel";
import UIComponent from "sap/ui/core/UIComponent";
import { Route$MatchedEvent } from "sap/ui/core/routing/Route";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";
import Context from "sap/ui/model/odata/v4/Context";
import Select from "sap/m/Select";
import MessageBox from "sap/m/MessageBox";

/**
 * @namespace flexso.cap.htf.securityoverview.controller
 */
export default class Master extends Controller {
  private appViewModel: JSONModel;

  public onInit(): void {
    const router = (this.getOwnerComponent() as Component).getRouter();
    router.getRoute("master")?.attachMatched(this.onRouteMatched.bind(this));
    router.getRoute("masterWithSelection")?.attachMatched(this.onRouteMatched.bind(this));

    this.appViewModel = new JSONModel({
      hasSelectedLocation: false
    });
    this.getView()?.setModel(this.appViewModel, "appView");
  }

  private onRouteMatched(event: Route$MatchedEvent): void {
    const routeName = event.getParameter("name");
    if (routeName === "master") {
        this.appViewModel.setProperty("/hasSelectedLocation", false);
        (this.byId("locationSelect") as Select).setSelectedItem(null);
    } else if (routeName === "masterWithSelection") {
        const cameraImageGuid = (event.getParameter("arguments") as { id: string }).id;
        this.appViewModel.setProperty("/hasSelectedLocation", true);
        this.getView()?.bindElement({ 
            path: `/CameraImages(${cameraImageGuid})`,
            parameters: {
                $expand: "subnauticLocation"
            }
        });
    }
  }

  public onSelectLocation(oEvent: ui5Event): void {
    const locationId = (oEvent.getSource() as Select).getSelectedKey();
    const odataModel = this.getView()?.getModel() as ODataModel;
    const functionBinding = odataModel.bindContext(`/getCamerarecordingIdForLocation(...)`);
    functionBinding.setParameter("location", locationId);

    functionBinding.execute().then(() => {
        const context = functionBinding.getBoundContext();
        const cameraImageGuid = context.getProperty("value") as string;
        
        if (cameraImageGuid) {
            const router = (this.getOwnerComponent() as UIComponent).getRouter();
            router.navTo("masterWithSelection", {
              id: cameraImageGuid
            });
        }
    }).catch((error: any) => {
        const errorMessage = error.message.includes("The camera for this location is damaged") 
            ? "Cannot display recording: The camera at this location is damaged."
            : "An unknown error occurred.";
        MessageBox.error(errorMessage);
    });
  }
}