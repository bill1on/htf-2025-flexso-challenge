import Controller from "sap/ui/core/mvc/Controller";
import Component from "../Component";
import formatter from "../model/formatter";
import ODataContextBinding from "sap/ui/model/odata/v4/ODataContextBinding";
import Context from "sap/ui/model/odata/v4/Context";
import Binding from "sap/ui/model/Binding";
import ListItemBase from "sap/m/ListItemBase";
import Table from "sap/m/Table";
import JSONModel from "sap/ui/model/json/JSONModel";
import Fragment from "sap/ui/core/Fragment";
import Dialog from "sap/m/Dialog";
import Sorter from "sap/ui/model/Sorter";
import BusyIndicator from "sap/ui/core/BusyIndicator";
import ProcessFlowLaneHeader from "sap/suite/ui/commons/ProcessFlowLaneHeader";
import ProcessFlow from "sap/suite/ui/commons/ProcessFlow";
import ListItem from "sap/ui/core/ListItem";
import ui5Event from "sap/ui/base/Event";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import CustomListItem from "sap/m/CustomListItem";
import Button from "sap/m/Button";
import ColumnListItem from "sap/m/ColumnListItem";
import ODataModelV2 from "sap/ui/model/odata/v2/ODataModel";
import ODataModelV4 from "sap/ui/model/odata/v4/ODataModel";
/**
 * @namespace flexso.cap.htf.baserepair.controller
 */
export default class Master extends Controller {
  formatter = formatter;
  table: Table;
  orderDialog: Dialog;

  public onInit(): void {
    (this.getOwnerComponent() as Component)
      .getRouter()
      .attachRouteMatched(this.onRouteMatched, this);
  }

  onRouteMatched() {
    const oView = this.getView();

    oView?.bindElement({
    path: "/ProductCamera('0a85863f-100d-4e0b-91a1-89897f4490d6')",
    parameters: {
      expand: "materials", // haal de gerelateerde materialen ook op
    },
  });

    this.table = this.byId("idMaterialTable") as Table;

    const oElementBinding = oView?.getElementBinding();
  if (oElementBinding) {
    oElementBinding.attachEventOnce("dataReceived", () => {
      const oContext = oElementBinding.getBoundContext();
      if (oContext) {
        // Bind de tabel-items relatief aan de 'materials' property
        this.table.bindItems({
          path: "materials",
          template: (this.table as any)
            .getBindingInfo("items")
            ?.template?.clone(), // hergebruik de XML-template
        });
      }
    });
  }
  }

  async order() {
    const orderModel = new JSONModel({
      amount: 0,
    });

    if (!this.orderDialog) {
      this.orderDialog ??= (await Fragment.load({
        name: "flexso.cap.htf.baserepair.view.fragments.order",
        controller: this,
      })) as Dialog;

      this.getView()?.addDependent(this.orderDialog);
    }

    this.orderDialog.setModel(orderModel, "order");

    this.orderDialog.open();
  }

  async saveOrder() {
    this.orderDialog.close();
    BusyIndicator.show();
    const amount = parseInt(
      this.orderDialog.getModel("order")?.getProperty("/amount") as string
    );

    if (amount === 0 || amount === undefined) {
      BusyIndicator.hide();
      return;
    }
    this.table.getSelectedItems().forEach(async (item: ListItemBase) => {
      const contextBinding = this.getView()
        ?.getModel()
        ?.bindContext(
          `${(
            item.getBindingContext() as Context
          ).getPath()}/AdminService.order(...)`,
          item.getBindingContext() as Context
        ) as ODataContextBinding;

      contextBinding.setParameter(
        "amount",
        parseInt(
          this.orderDialog.getModel("order")?.getProperty("/amount") as string
        )
      );

      contextBinding.setParameter(
        "id",
        item.getBindingContext()!.getProperty("ID")
      );

      await contextBinding.invoke();
      this.refresh();
      BusyIndicator.hide();
    });
  }
  closeDialog() {
    this.orderDialog.close();
  }

  refresh() {
    this.table.getModel()?.refresh();
  }

  async produce() {
  BusyIndicator.show();

  try {
    const oView = this.getView();
    const oModel = oView?.getModel();
    const oCtx = oView?.getBindingContext() as Context; // ProductCamera context

    if (!oCtx || !oModel) {
      console.error("No bound ProductCamera context found");
      BusyIndicator.hide();
      return;
    }

    // Bind de produce-actie aan de ProductCamera
    const contextBinding = oModel.bindContext(
      `${oCtx.getPath()}/AdminService.produce(...)`,
      oCtx
    ) as ODataContextBinding;

    // Geef eventueel parameters mee als je backend ze verwacht
    contextBinding.setParameter("id", oCtx.getProperty("ID"));

    await contextBinding.invoke();

    // Refresh na productie
    this.refresh();

  } catch (err) {
    console.error("Produce failed:", err);
  } finally {
    BusyIndicator.hide();
  }
}


  refeshProducton() {
    const processFlow = this.byId("processflow") as ProcessFlow;
    processFlow.updateModel();
  }

  async replaceCamera(event: ui5Event) {
    BusyIndicator.show();
    try {
        const button = event.getSource() as Button;
        const listItem = button.getParent()?.getParent() as ColumnListItem;
        if (!listItem) throw new Error("Kan de rij niet vinden.");

        const modelName = "mainService"; // je OData V4 model naam
        const ctx = listItem.getBindingContext(modelName) as Context;
        if (!ctx) throw new Error("Kan de OData V4 context niet vinden.");

        const model = this.getView()?.getModel() as ODataModelV4;

        // Bind aan de action
        const actionContext = model.bindContext("/replaceInstallation(...)", ctx);
        actionContext.setParameter("id", ctx.getProperty("ID"));

        // Execute action
        await actionContext.execute();

        MessageToast.show("✅ Camera replaced successfully");

        // Refresh tabel
        const table = this.byId("idInstallations") as any;
        table.getModel()?.refresh();

    } catch (err: any) {
        MessageBox.error(err.message || "❌ Failed to replace camera");
    } finally {
        BusyIndicator.hide();
    }
}

}
