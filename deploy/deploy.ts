import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedMaskDB = await deploy("MaskDB", {
    from: deployer,
    log: true,
  });

  console.log(`MaskDB contract: `, deployedMaskDB.address);
};
export default func;
func.id = "deploy_maskdb"; // id required to prevent reexecution
func.tags = ["MaskDB"];
