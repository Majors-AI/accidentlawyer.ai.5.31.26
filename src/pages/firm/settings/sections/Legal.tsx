// Legal department — the shared framework plus the legal PI workflow.
import DepartmentSection from './DepartmentSection';
import LegalWorkflow from './legal/LegalWorkflow';

export default function Legal() {
  return (
    <>
      <DepartmentSection deptId="legal" />
      <LegalWorkflow />
    </>
  );
}
