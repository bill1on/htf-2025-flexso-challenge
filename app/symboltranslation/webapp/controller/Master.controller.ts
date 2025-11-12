/* eslint-disable linebreak-style */
import Dialog from "sap/m/Dialog";
import ListItemBase from "sap/m/ListItemBase";
import Table from "sap/m/Table";
import Fragment from "sap/ui/core/Fragment";
import Controller from "sap/ui/core/mvc/Controller";
import Binding from "sap/ui/model/Binding";
import JSONModel from "sap/ui/model/json/JSONModel";
import Context from "sap/ui/model/odata/v4/Context";
import ODataContextBinding from "sap/ui/model/odata/v4/ODataContextBinding";
import ODataListBinding from "sap/ui/model/odata/v4/ODataListBinding";

/**
 * @namespace flexso.cap.htf.symboltranslation.controller
 */
export default class Master extends Controller {
  creationDialog: Dialog;
  table: Table;
  /*eslint-disable @typescript-eslint/no-empty-function*/
  public onInit(): void {
    this.table = this.byId("idProductsTable") as Table;
  }

  async addIcon() {
    const createModel = new JSONModel({
      symbol: "",
      whereFound: "",
      language: "",
    });

    if (!this.creationDialog) {
      this.creationDialog ??= (await Fragment.load({
        name: "flexso.cap.htf.symboltranslation.view.fragments.create",
        controller: this,
      })) as Dialog;

      this.getView()?.addDependent(this.creationDialog);
    }

    this.creationDialog.setModel(createModel, "create");

    this.creationDialog.open();
  }

  onSave() {
    //This is save logic for creating a new Symbol
    const listBinding = this.getView()
      ?.getModel()
      ?.bindList("/Symbols") as ODataListBinding;

    const data = this.creationDialog.getModel("create");

    listBinding.create({
      symbol: data?.getProperty("/symbol") as string,
      whereFound: data?.getProperty("/whereFound") as string,
      language: data?.getProperty("/language") as string,
    });

    this.creationDialog.close();
    (this.table.getBinding("items") as Binding).refresh();
  }

  closeDialog() {
    this.creationDialog.close();
  }

  async translate() {
    //The code below is standard code for calling an OData Action bound to an entity in a list
    this.table.getSelectedItems().forEach(async (item: ListItemBase) => {
      const contextBinding = this.getView()
        ?.getModel()
        ?.bindContext(
          `${(
            item.getBindingContext() as Context
          ).getPath()}/AdminService.translateSymbolBound(...)`,
          item.getBindingContext() as Context
        ) as ODataContextBinding;

      await contextBinding.invoke();
      (this.table.getBinding("items") as Binding).refresh();
    });
  }
}
