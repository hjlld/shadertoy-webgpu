import './style.css';
import { Shadertoy } from '../lib/Shadertoy';

const app = document.querySelector<HTMLDivElement>('#app')!;
const shadertoy = await Shadertoy.Create( app );
await shadertoy.GetCodeByID( 'Ms2SD1' );
await shadertoy.InitRenderer();
shadertoy.Render();
