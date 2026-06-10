// Intake department — the shared framework plus the intake-specific PI workflow.
import DepartmentSection from './DepartmentSection';
import IntakePipeline from './intake/IntakePipeline';

export default function Intake() {
  return (
    <>
      <DepartmentSection deptId="intake" />
      <IntakePipeline />
    </>
  );
}
